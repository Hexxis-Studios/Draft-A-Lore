using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web;
using System.Web.Script.Serialization;

internal sealed class GoogleBackupBroker : IDisposable
{
    private const string ClientId = "886807251567-373pre1nj78rtdnh9aqb404r7bkcl5ud.apps.googleusercontent.com";
    private const string Scope = "https://www.googleapis.com/auth/drive.appdata";
    private readonly TcpListener listener;
    private readonly string capability = RandomValue();
    private readonly object gate = new object();
    private readonly ManualResetEvent stopped = new ManualResetEvent(false);
    private readonly SemaphoreSlim slots = new SemaphoreSlim(8, 8);
    private readonly Timer idleTimer;
    private volatile bool disposed;
    private string state, verifier, requestAttempt;
    private DateTime started, lastUse = DateTime.UtcNow;
    private Dictionary<string, object> outcome;
    private bool connecting, exchanging;
    internal readonly int Port;

    internal GoogleBackupBroker()
    {
        listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start(8);
        Port = ((IPEndPoint)listener.LocalEndpoint).Port;
        idleTimer = new Timer(unused => { if ((DateTime.UtcNow - lastUse).TotalMinutes > 30) Dispose(); }, null, 60000, 60000);
        Thread thread = new Thread(Serve);
        thread.IsBackground = true;
        thread.Start();
    }

    internal string LaunchFragment { get { return "#dal-desktop=" + Port + "." + capability; } }
    internal void Wait() { stopped.WaitOne(); }

    private static string RandomValue()
    {
        byte[] bytes = new byte[32];
        using (RandomNumberGenerator rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static bool Equal(string left, string right)
    {
        if (left == null || right == null || left.Length != right.Length) return false;
        int difference = 0;
        for (int i = 0; i < left.Length; i++) difference |= left[i] ^ right[i];
        return difference == 0;
    }

    private void Serve()
    {
        try {
            while (!disposed) {
                TcpClient client = listener.AcceptTcpClient();
                if (!slots.Wait(0)) { client.Close(); continue; }
                ThreadPool.QueueUserWorkItem(unused => { try { Handle(client); } finally { slots.Release(); } });
            }
        } catch (SocketException) { Dispose(); }
        catch (ObjectDisposedException) { Dispose(); }
    }

    private void Handle(TcpClient client)
    {
        using (client) {
            client.ReceiveTimeout = 5000;
            client.SendTimeout = 5000;
            try {
                NetworkStream stream = client.GetStream();
                StringBuilder header = new StringBuilder();
                while (header.Length < 8192) {
                    int next = stream.ReadByte();
                    if (next < 0) return;
                    header.Append((char)next);
                    if (header.Length >= 4 && header.ToString(header.Length - 4, 4) == "\r\n\r\n") break;
                }
                if (!header.ToString().EndsWith("\r\n\r\n")) return;
                string[] lines = header.ToString().Split(new string[] { "\r\n" }, StringSplitOptions.None);
                string[] first = lines[0].Split(' ');
                if (first.Length != 3 || !first[1].StartsWith("/") || first[1].StartsWith("//")) return;
                Dictionary<string, string> headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < lines.Length && lines[i].Length > 0; i++) {
                    int colon = lines[i].IndexOf(':');
                    if (colon < 1) return;
                    string name = lines[i].Substring(0, colon);
                    if (headers.ContainsKey(name)) return;
                    headers[name] = lines[i].Substring(colon + 1).Trim();
                }
                string host, origin, authorization, attemptId;
                if (!headers.TryGetValue("Host", out host) || host != "127.0.0.1:" + Port) return;
                Uri url = new Uri("http://127.0.0.1:" + Port + first[1]);
                bool callback = url.AbsolutePath == "/oauth/callback";
                bool allowedOrigin = headers.TryGetValue("Origin", out origin) && origin == "null";
                if (callback && first[0] == "GET") {
                    Callback(url);
                    Respond(stream, 200, "Google authorization finished. Return to Draft A Lore. You may close this tab.", false, false);
                    return;
                }
                if (!allowedOrigin) { Respond(stream, 403, "{}", false, true); return; }
                if (first[0] == "OPTIONS") {
                    Respond(stream, 204, "", true, true);
                    return;
                }
                if (!headers.TryGetValue("Authorization", out authorization) || !Equal(authorization, "Bearer " + capability)) {
                    Respond(stream, 403, "{}", true, true); return;
                }
                if (!headers.TryGetValue("X-DraftALore-Attempt", out attemptId) || !System.Text.RegularExpressions.Regex.IsMatch(attemptId, "^[a-f0-9]{32}$")) {
                    Respond(stream, 400, "{}", true, true); return;
                }
                string length;
                if (headers.ContainsKey("Transfer-Encoding") || (headers.TryGetValue("Content-Length", out length) && length != "0")) {
                    Respond(stream, 400, "{}", true, true); return;
                }
                lastUse = DateTime.UtcNow;
                Dictionary<string, object> response;
                lock (gate) {
                    if (url.AbsolutePath == "/connect" && first[0] == "POST") {
                        if ((connecting || exchanging) && (DateTime.UtcNow - started).TotalSeconds <= 180) {
                            response = new Dictionary<string, object> { { "error", "Google sign-in is already open." } };
                        } else {
                            requestAttempt = attemptId;
                            Begin();
                            response = new Dictionary<string, object> { { "pending", true } };
                        }
                    } else if (url.AbsolutePath == "/result" && first[0] == "GET") {
                        if (!Equal(attemptId, requestAttempt)) { Respond(stream, 409, "{}", true, true); return; }
                        if ((connecting || exchanging) && (DateTime.UtcNow - started).TotalSeconds > 180) Cancel("Google sign-in timed out. No files were uploaded.");
                        response = outcome ?? new Dictionary<string, object> { { "pending", connecting || exchanging } };
                        outcome = null;
                    } else if (url.AbsolutePath == "/disconnect" && first[0] == "POST") {
                        if (Equal(attemptId, requestAttempt)) Cancel(null);
                        response = new Dictionary<string, object> { { "disconnected", true } };
                    } else { Respond(stream, 404, "{}", true, true); return; }
                }
                Respond(stream, 200, new JavaScriptSerializer().Serialize(response), true, true);
            } catch (Exception) { /* Never expose request bodies, authorization codes, or tokens in diagnostics. */ }
        }
    }

    private void Begin()
    {
        state = RandomValue(); verifier = RandomValue(); outcome = null; connecting = true; exchanging = false; started = DateTime.UtcNow;
        string challenge;
        using (SHA256 hash = SHA256.Create()) challenge = Convert.ToBase64String(hash.ComputeHash(Encoding.ASCII.GetBytes(verifier))).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        string redirect = "http://127.0.0.1:" + Port + "/oauth/callback";
        string url = "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + Uri.EscapeDataString(ClientId)
            + "&redirect_uri=" + Uri.EscapeDataString(redirect) + "&response_type=code&scope=" + Uri.EscapeDataString(Scope)
            + "&code_challenge_method=S256&code_challenge=" + challenge + "&state=" + state + "&access_type=online&prompt=select_account";
        try { Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true }); }
        catch (Exception) { Cancel("The browser could not open Google sign-in. Local projects are unchanged."); }
    }

    private void Callback(Uri url)
    {
        var query = HttpUtility.ParseQueryString(url.Query);
        string attempt, proof;
        lock (gate) {
            if (!connecting || !Equal(query["state"], state) || (DateTime.UtcNow - started).TotalSeconds > 180) return;
            attempt = state; proof = verifier;
            connecting = false; exchanging = true;
            if (query["error"] != null || String.IsNullOrEmpty(query["code"]) || query["code"].Length > 4096) {
                Cancel("Google access was cancelled or denied. Local projects are unchanged."); return;
            }
        }
        try {
            string body = "client_id=" + Uri.EscapeDataString(ClientId) + "&grant_type=authorization_code&code=" + Uri.EscapeDataString(query["code"])
                + "&code_verifier=" + Uri.EscapeDataString(proof) + "&redirect_uri=" + Uri.EscapeDataString("http://127.0.0.1:" + Port + "/oauth/callback");
            byte[] bytes = Encoding.UTF8.GetBytes(body);
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("https://oauth2.googleapis.com/token");
            request.Method = "POST"; request.ContentType = "application/x-www-form-urlencoded";
            request.AllowAutoRedirect = false; request.Timeout = 15000; request.ReadWriteTimeout = 15000; request.ContentLength = bytes.Length;
            using (Stream output = request.GetRequestStream()) output.Write(bytes, 0, bytes.Length);
            string json;
            using (HttpWebResponse reply = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(reply.GetResponseStream())) {
                char[] chars = new char[32769]; int total = 0, read;
                while (total < chars.Length && (read = reader.Read(chars, total, chars.Length - total)) > 0) total += read;
                if (total > 32768) throw new InvalidDataException();
                json = new string(chars, 0, total);
            }
            Dictionary<string, object> data = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(json);
            object rawToken, rawExpiry, rawScope;
            if (!data.TryGetValue("access_token", out rawToken) || !(rawToken is string) || String.IsNullOrEmpty((string)rawToken)
                || !data.TryGetValue("expires_in", out rawExpiry) || Convert.ToDouble(rawExpiry) <= 15
                || !data.TryGetValue("scope", out rawScope) || (string)rawScope != Scope) throw new InvalidDataException();
            lock (gate) {
                if (!Equal(attempt, state)) return;
                outcome = new Dictionary<string, object> { { "accessToken", rawToken }, { "expiresIn", Math.Min(3600, Convert.ToDouble(rawExpiry)) }, { "scope", Scope } };
                state = null; verifier = null;
                exchanging = false;
            }
        } catch (Exception) {
            lock (gate) { if (Equal(attempt, state)) Cancel("Google authorization could not finish. Local backups still work."); }
        }
    }

    private void Cancel(string error)
    {
        state = null; verifier = null; connecting = false; exchanging = false;
        outcome = error == null ? null : new Dictionary<string, object> { { "error", error } };
    }

    private static void Respond(NetworkStream stream, int status, string body, bool cors, bool json)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(body);
        string headers = "HTTP/1.1 " + status + " Result\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'none'\r\nContent-Type: "
            + (json ? "application/json" : "text/plain") + "; charset=utf-8\r\nContent-Length: " + bytes.Length + "\r\n";
        if (cors) headers += "Access-Control-Allow-Origin: null\r\nAccess-Control-Allow-Methods: GET, POST\r\nAccess-Control-Allow-Headers: Authorization, X-DraftALore-Attempt\r\nAccess-Control-Allow-Private-Network: true\r\nVary: Origin\r\n";
        byte[] prefix = Encoding.ASCII.GetBytes(headers + "\r\n");
        stream.Write(prefix, 0, prefix.Length); stream.Write(bytes, 0, bytes.Length);
    }

    public void Dispose()
    {
        disposed = true;
        lock (gate) { Cancel(null); }
        listener.Stop(); stopped.Set();
        idleTimer.Dispose();
    }
}

using System;
using System.Net;
using System.IO;

internal static class GoogleBackupBrokerTest
{
    private static int Call(int port, string origin, string capability, string attempt, string method)
    {
        HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/disconnect");
        request.Proxy = null; request.Timeout = 3000; request.Method = method;
        if (method == "POST") request.ContentLength = 0;
        if (origin != null) request.Headers["Origin"] = origin;
        if (capability != null) request.Headers["Authorization"] = "Bearer " + capability;
        if (attempt != null) request.Headers["X-DraftALore-Attempt"] = attempt;
        try {
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) {
                if (response.Headers["Cache-Control"] != "no-store") throw new Exception("Credential response caching is not disabled.");
                return (int)response.StatusCode;
            }
        } catch (WebException error) {
            using (HttpWebResponse response = (HttpWebResponse)error.Response) {
                if (response == null) throw;
                return (int)response.StatusCode;
            }
        }
    }

    private static void Expect(int actual, int expected) { if (actual != expected) throw new Exception("Expected " + expected + ", got " + actual); }
    internal static int Main()
    {
        using (GoogleBackupBroker broker = new GoogleBackupBroker()) {
            string capability = broker.LaunchFragment.Split('.')[1];
            string attempt = new string('a', 32);
            Expect(Call(broker.Port, null, null, null, "POST"), 403);
            Expect(Call(broker.Port, "https://example.com", capability, attempt, "POST"), 403);
            Expect(Call(broker.Port, "null", "wrong", attempt, "POST"), 403);
            Expect(Call(broker.Port, "null", capability, "bad", "POST"), 400);
            Expect(Call(broker.Port, "null", capability, attempt, "POST"), 200);
            Expect(Call(broker.Port, "null", null, null, "OPTIONS"), 204);
            Console.WriteLine("Desktop broker compile and six local security checks passed. No Google sign-in or upload attempted.");
        }
        return 0;
    }
}

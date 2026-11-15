[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseDir = Join-Path $repoRoot 'releases'
$htmlPath = Join-Path $releaseDir 'DraftALore.html'
$outputPath = Join-Path $releaseDir 'DraftALore.exe'
$zipPath = Join-Path $releaseDir 'DraftALore-Windows.zip'
$iconPath = Join-Path $releaseDir 'favicon.ico'

if (-not (Test-Path -LiteralPath $htmlPath -PathType Leaf)) {
    throw 'releases\DraftALore.html is missing. Run python build.py first.'
}

$compilerCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$compiler = $compilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $compiler) {
    throw 'The Windows .NET Framework C# compiler was not found.'
}

$temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('DraftALoreBuild-' + [guid]::NewGuid().ToString('N'))
$packageDir = Join-Path $temporaryDir 'package'
New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

try {
    $sourcePath = Join-Path $temporaryDir 'DraftALoreLauncher.cs'
    $source = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Draft A Lore")]
[assembly: AssemblyDescription("Offline writing and RPG adventure design studio")]
[assembly: AssemblyCompany("Hexxis Studios (Daymien Vanhorn)")]
[assembly: AssemblyProduct("Draft A Lore")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class DraftALoreLauncher
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args != null && args.Length > 0 &&
            String.Equals(args[0], "--install-shortcuts", StringComparison.OrdinalIgnoreCase))
            return InstallShortcuts();

        string appDirectory = AppDomain.CurrentDomain.BaseDirectory;
        string htmlPath = Path.Combine(appDirectory, "DraftALore.html");
        if (!File.Exists(htmlPath))
        {
            MessageBox.Show(
                "DraftALore.html must be kept in the same folder as DraftALore.exe.",
                "Draft A Lore",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }

        try
        {
            string browser = FindBrowser();
            if (browser != null)
            {
                GoogleBackupBroker helper = null;
                try { helper = new GoogleBackupBroker(); } catch (Exception) { }
                using (GoogleBackupBroker backup = helper)
                {
                    string fileUrl = new Uri(htmlPath).AbsoluteUri + (backup == null ? "" : backup.LaunchFragment);
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = browser,
                        Arguments = "--app=\"" + fileUrl + "\" --window-size=1400,900",
                        WorkingDirectory = appDirectory,
                        UseShellExecute = false
                    });
                    if (backup != null) backup.Wait();
                }
            }
            else
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = htmlPath,
                    WorkingDirectory = appDirectory,
                    UseShellExecute = true
                });
            }
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Draft A Lore could not open.\n\n" + error.Message +
                "\n\nYou can still open DraftALore.html directly in a browser.",
                "Draft A Lore",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static int InstallShortcuts()
    {
        DialogResult desktopChoice = MessageBox.Show(
            "Create a Draft A Lore shortcut on the Desktop?",
            "Draft A Lore Shortcuts",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Question);
        if (desktopChoice == DialogResult.Cancel) return 0;

        DialogResult startChoice = MessageBox.Show(
            "Add Draft A Lore to the Start Menu?",
            "Draft A Lore Shortcuts",
            MessageBoxButtons.YesNoCancel,
            MessageBoxIcon.Question);
        if (startChoice == DialogResult.Cancel) return 0;
        if (desktopChoice == DialogResult.No && startChoice == DialogResult.No)
        {
            MessageBox.Show("No shortcuts were created.", "Draft A Lore");
            return 0;
        }

        try
        {
            string launcherPath = Process.GetCurrentProcess().MainModule.FileName;
            string appDirectory = Path.GetDirectoryName(launcherPath);
            int created = 0;
            if (desktopChoice == DialogResult.Yes)
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                CreateShortcut(Path.Combine(desktop, "Draft A Lore.lnk"), launcherPath, appDirectory);
                created++;
            }
            if (startChoice == DialogResult.Yes)
            {
                string programs = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
                Directory.CreateDirectory(programs);
                CreateShortcut(Path.Combine(programs, "Draft A Lore.lnk"), launcherPath, appDirectory);
                created++;
            }
            MessageBox.Show("Created " + created + " shortcut" + (created == 1 ? "." : "s."), "Draft A Lore");
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "Draft A Lore could not create the shortcuts.\n\n" + error.Message,
                "Draft A Lore",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 1;
        }
    }

    private static void CreateShortcut(string linkPath, string launcherPath, string appDirectory)
    {
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType == null) throw new InvalidOperationException("Windows shortcut support is unavailable.");
        object shell = Activator.CreateInstance(shellType);
        object shortcut = null;
        try
        {
            shortcut = shellType.InvokeMember(
                "CreateShortcut",
                BindingFlags.InvokeMethod | BindingFlags.Public | BindingFlags.Instance,
                null,
                shell,
                new object[] { linkPath });
            Type shortcutType = shortcut.GetType();
            SetShortcutProperty(shortcutType, shortcut, "TargetPath", launcherPath);
            SetShortcutProperty(shortcutType, shortcut, "Arguments", "");
            SetShortcutProperty(shortcutType, shortcut, "WorkingDirectory", appDirectory);
            SetShortcutProperty(shortcutType, shortcut, "Description", "Draft A Lore writing and RPG studio");
            SetShortcutProperty(shortcutType, shortcut, "IconLocation", launcherPath + ",0");
            shortcutType.InvokeMember(
                "Save",
                BindingFlags.InvokeMethod | BindingFlags.Public | BindingFlags.Instance,
                null,
                shortcut,
                null);
        }
        finally
        {
            if (shortcut != null && System.Runtime.InteropServices.Marshal.IsComObject(shortcut))
                System.Runtime.InteropServices.Marshal.ReleaseComObject(shortcut);
            if (System.Runtime.InteropServices.Marshal.IsComObject(shell))
                System.Runtime.InteropServices.Marshal.ReleaseComObject(shell);
        }
    }

    private static void SetShortcutProperty(Type shortcutType, object shortcut, string name, object value)
    {
        shortcutType.InvokeMember(
            name,
            BindingFlags.SetProperty | BindingFlags.Public | BindingFlags.Instance,
            null,
            shortcut,
            new object[] { value });
    }
    private static string FindBrowser()
    {
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] candidates =
        {
            Path.Combine(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(programFiles, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
            Path.Combine(programFilesX86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
            Path.Combine(programFiles, "Vivaldi", "Application", "vivaldi.exe"),
            Path.Combine(localAppData, "Vivaldi", "Application", "vivaldi.exe")
        };

        foreach (string candidate in candidates)
        {
            if (!String.IsNullOrEmpty(candidate) && File.Exists(candidate))
                return candidate;
        }
        return null;
    }
}
'@
    Set-Content -LiteralPath $sourcePath -Value $source -Encoding UTF8

    $compilerArguments = @(
        '/nologo',
        '/target:winexe',
        '/optimize+',
        '/platform:anycpu',
        '/reference:System.Windows.Forms.dll',
        '/reference:System.Web.dll',
        '/reference:System.Web.Extensions.dll',
        ('/out:' + $outputPath)
    )
    if (Test-Path -LiteralPath $iconPath -PathType Leaf) {
        $compilerArguments += '/win32icon:' + $iconPath
    }
    $compilerArguments += $sourcePath
    $compilerArguments += (Join-Path $repoRoot 'scripts/GoogleBackupBroker.cs')

    & $compiler $compilerArguments
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
        throw 'The Windows launcher did not compile successfully.'
    }

    $packageFiles = @(
        'DraftALore.exe',
        'DraftALore.html',
        'favicon.ico',
        'Install-DraftALore.bat',
        'README-WINDOWS.txt'
    )
    foreach ($name in $packageFiles) {
        $sourceFile = Join-Path $releaseDir $name
        if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
            Copy-Item -LiteralPath $sourceFile -Destination $packageDir
        }
    }

    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path (Join-Path $packageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

    Write-Host ('Built releases\DraftALore.exe ({0:N0} bytes)' -f (Get-Item -LiteralPath $outputPath).Length)
    Write-Host ('Built releases\DraftALore-Windows.zip ({0:N0} bytes)' -f (Get-Item -LiteralPath $zipPath).Length)
}
finally {
    if (Test-Path -LiteralPath $temporaryDir) {
        Remove-Item -LiteralPath $temporaryDir -Recurse -Force
    }
}

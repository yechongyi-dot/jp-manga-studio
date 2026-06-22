Option Explicit
Dim WshShell, fso, dir, exitCode, isFirst

Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")
dir     = fso.GetParentFolderName(WScript.ScriptFullName)
isFirst = True

WshShell.Environment("Process")("PATH") = _
    "C:\Program Files\nodejs;" & _
    "C:\Program Files (x86)\nodejs;" & _
    "C:\Program Files\Git\cmd;" & _
    "C:\Program Files\Git\bin;" & _
    WshShell.Environment("Process")("PATH")

Do
    WshShell.CurrentDirectory = dir
    If isFirst Then
        WshShell.Run "cmd /c timeout /t 3 /nobreak >nul && start http://localhost:3020", 0, False
        isFirst = False
    End If
    exitCode = WshShell.Run("node jp-server.js", 0, True)
    If exitCode <> 123 Then Exit Do
    WScript.Sleep 2000
Loop

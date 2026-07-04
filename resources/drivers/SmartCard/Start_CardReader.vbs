Set oShell = CreateObject("WScript.Shell")
oShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
oShell.Run "java -jar printdaemon\JSmartCardReader.jar 8443 001", 0, False
WScript.Sleep 3000
oShell.Run "http://localhost:8084/smartcard/data/", 0, False

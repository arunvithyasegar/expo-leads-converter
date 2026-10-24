import os
import sys
import subprocess

def create_shortcuts():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    # Detect Desktop path from Windows Environment
    cmd = "[System.Environment]::GetFolderPath('Desktop')"
    desktop = subprocess.check_output(["powershell", "-NoProfile", "-Command", cmd], text=True).strip()
    print("Desktop path detected:", desktop)

    if not os.path.exists(desktop):
        os.makedirs(desktop, exist_ok=True)

    app_dir = os.path.dirname(os.path.abspath(__file__))
    app_escaped = app_dir.replace("'", "''")

    # 1. Add Attendee Shortcut (.lnk)
    vbs_attendee = os.path.join(app_dir, "launch_add_attendee.vbs")
    lnk_attendee = os.path.join(desktop, "Add Attendee - Anna Incubator.lnk")
    lnk_att_escaped = lnk_attendee.replace("'", "''")
    vbs_att_escaped = vbs_attendee.replace("'", "''")

    ps_script1 = f"""
$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut('{lnk_att_escaped}')
$lnk.TargetPath = 'wscript.exe'
$lnk.Arguments = '"{vbs_att_escaped}"'
$lnk.WorkingDirectory = '{app_escaped}'
$lnk.Description = 'Open Anna Incubator Lead Desk - Add Attendee Contact Form (Mic Enabled, Zero Prompts)'
$lnk.IconLocation = 'C:\\Windows\\System32\\shell32.dll,269'
$lnk.Save()
"""
    subprocess.check_call(["powershell", "-NoProfile", "-Command", ps_script1])
    print("✓ Created LNK shortcut:", lnk_attendee)

    # 2. Add Attendee URL shortcut (.url)
    url_attendee = os.path.join(desktop, "Add Attendee - Anna Incubator.url")
    with open(url_attendee, "w", encoding="utf-8") as f:
        f.write("[InternetShortcut]\nURL=http://127.0.0.1:8080/#add-attendee\nIconFile=C:\\Windows\\System32\\shell32.dll\nIconIndex=269\n")
    print("✓ Created URL shortcut:", url_attendee)

    # 3. Full Lead Desk Shortcut (.lnk)
    vbs_desk = os.path.join(app_dir, "launch_lead_desk.vbs")
    lnk_desk = os.path.join(desktop, "Anna Incubator - Lead Desk.lnk")
    lnk_desk_escaped = lnk_desk.replace("'", "''")
    vbs_desk_escaped = vbs_desk.replace("'", "''")

    ps_script2 = f"""
$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut('{lnk_desk_escaped}')
$lnk.TargetPath = 'wscript.exe'
$lnk.Arguments = '"{vbs_desk_escaped}"'
$lnk.WorkingDirectory = '{app_escaped}'
$lnk.Description = 'Anna Incubator ETM Lead Desk & Audio Transcription Database (Mic Enabled, Zero Prompts)'
$lnk.IconLocation = 'C:\\Windows\\System32\\shell32.dll,13'
$lnk.Save()
"""
    subprocess.check_call(["powershell", "-NoProfile", "-Command", ps_script2])
    print("✓ Created LNK shortcut:", lnk_desk)

    # 4. Full Lead Desk URL shortcut (.url)
    url_desk = os.path.join(desktop, "Anna Incubator - Lead Desk.url")
    with open(url_desk, "w", encoding="utf-8") as f:
        f.write("[InternetShortcut]\nURL=http://127.0.0.1:8080\nIconFile=C:\\Windows\\System32\\shell32.dll\nIconIndex=13\n")
    print("✓ Created URL shortcut:", url_desk)

if __name__ == "__main__":
    create_shortcuts()

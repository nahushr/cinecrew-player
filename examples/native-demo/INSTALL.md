# Native demo installation

These commands build and run the CineCrew Player Android demo on an Android Virtual Device (AVD). They install the command-line toolchain without Android Studio. The project currently targets Android API 35 and pins NDK `26.1.10909125`.

## Android emulator from Terminal

Choose the instructions for your computer. The first terminal installs the SDK and creates/starts the emulator. Keep that terminal open while you use a second terminal to clone, build, and run the demo.

### macOS — Terminal 1: install tools and start the emulator

Paste this entire block into Terminal. Homebrew may ask for your Mac password and Apple Command Line Tools on a clean machine.

```bash
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

brew install git node openjdk@21

export JAVA_HOME="$(brew --prefix openjdk@21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$HOME/.local/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
mkdir -p "$ANDROID_HOME"

if [ "$(uname -m)" = "arm64" ]; then
  curl -fsSL https://dl.google.com/android/cli/latest/darwin_arm64/install.sh | bash
  ANDROID_IMAGE="system-images/android-35/google_apis/arm64-v8a"
else
  curl -fsSL https://dl.google.com/android/cli/latest/darwin_x86_64/install.sh | bash
  ANDROID_IMAGE="system-images/android-35/google_apis/x86_64"
fi

export PATH="$HOME/.local/bin:$PATH"
yes | android "--sdk=$ANDROID_HOME" sdk install \
  cmdline-tools/latest platform-tools emulator platforms/android-35 \
  build-tools/35.0.0 ndk/26.1.10909125 "$ANDROID_IMAGE"

android "--sdk=$ANDROID_HOME" emulator create --profile=medium_phone
android "--sdk=$ANDROID_HOME" emulator list
android "--sdk=$ANDROID_HOME" emulator start medium_phone
```

`emulator start` stays attached to this terminal. On Apple silicon it installs an ARM64 system image; on Intel Macs it installs x86_64.

### macOS — Terminal 2: build and run the APK

Open a second Terminal window and paste:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
export JAVA_HOME="$(brew --prefix openjdk@21)"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

git clone https://github.com/nahushr/cinecrew-player.git "$HOME/cinecrew-player"
cd "$HOME/cinecrew-player"
npm ci --prefix examples/native-demo
cd examples/native-demo/android
./gradlew assembleRelease --no-daemon
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell monkey -p com.nahushr.cinecrewplayernativedemo 1
```

To rotate the emulator 90° clockwise while the demo is open, run this command. Repeat it to cycle through orientations:

```bash
adb emu rotate
```

### Windows — PowerShell Terminal 1: install tools and start the emulator

Open Windows Terminal with **PowerShell as Administrator** and paste this block. It downloads Node.js LTS, Temurin JDK 21, Git for Windows, and Google's Android CLI directly from their publishers. Windows' Android CLI emulator subcommand is currently disabled, so this uses the SDK's included `avdmanager` to create the AVD and the emulator executable to launch it.

```powershell
$ErrorActionPreference = 'Stop'

$nodeRelease = Invoke-RestMethod 'https://nodejs.org/dist/index.json' |
  Where-Object { $_.lts } |
  Select-Object -First 1
$nodeMsi = Join-Path $env:TEMP "node-$($nodeRelease.version)-x64.msi"
Invoke-WebRequest "https://nodejs.org/dist/$($nodeRelease.version)/node-$($nodeRelease.version)-x64.msi" -OutFile $nodeMsi
Start-Process msiexec.exe -ArgumentList @('/i', $nodeMsi, '/qn', '/norestart') -Wait

$jdkMsi = Join-Path $env:TEMP 'temurin-jdk-21.msi'
Invoke-WebRequest 'https://api.adoptium.net/v3/installer/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $jdkMsi
Start-Process msiexec.exe -ArgumentList @('/i', $jdkMsi, '/qn', '/norestart') -Wait

$gitRelease = Invoke-RestMethod -Headers @{ 'User-Agent' = 'CineCrewPlayerSetup' } 'https://api.github.com/repos/git-for-windows/git/releases/latest'
$gitAsset = $gitRelease.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
$gitInstaller = Join-Path $env:TEMP $gitAsset.name
Invoke-WebRequest $gitAsset.browser_download_url -OutFile $gitInstaller
Start-Process $gitInstaller -ArgumentList @('/VERYSILENT', '/NORESTART', '/SP-') -Wait

$cliInstaller = Join-Path $env:TEMP 'android-cli-install.cmd'
Invoke-WebRequest 'https://dl.google.com/android/cli/latest/windows_x86_64/install.cmd' -OutFile $cliInstaller
& $env:ComSpec /d /c "`"$cliInstaller`""

$env:JAVA_HOME = (Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Directory |
  Where-Object { $_.Name -match '^jdk-21' } |
  Sort-Object Name -Descending |
  Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ProgramFiles\nodejs;$env:ProgramFiles\Git\cmd;$env:USERPROFILE\AppData\AndroidCLI;$env:Path"
New-Item -ItemType Directory -Force $env:ANDROID_HOME | Out-Null

$androidImage = 'system-images/android-35/google_apis/x86_64'
android "--sdk=$env:ANDROID_HOME" sdk install `
  cmdline-tools/latest platform-tools emulator platforms/android-35 `
  build-tools/35.0.0 ndk/26.1.10909125 $androidImage

& "$env:ANDROID_HOME\cmdline-tools\latest\bin\avdmanager.bat" `
  create avd -n CineCrewPlayer -k 'system-images;android-35;google_apis;x86_64' -d pixel_2 -f
Start-Process -FilePath "$env:ANDROID_HOME\emulator\emulator.exe" `
  -ArgumentList @('-avd', 'CineCrewPlayer', '-no-snapshot-load')
adb wait-for-device
do {
  Start-Sleep -Seconds 3
  $bootComplete = adb shell getprop sys.boot_completed
} until ($bootComplete -match '1')
```

If Windows reports that hardware acceleration is unavailable, enable CPU virtualization in firmware. In an elevated PowerShell, enable the Windows Hypervisor Platform and restart Windows:

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All
Restart-Computer
```

### Windows — PowerShell Terminal 2: build and run the APK

Open a second PowerShell window and paste:

```powershell
$env:JAVA_HOME = (Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Directory |
  Where-Object { $_.Name -match '^jdk-21' } |
  Sort-Object Name -Descending |
  Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ProgramFiles\nodejs;$env:ProgramFiles\Git\cmd;$env:USERPROFILE\AppData\AndroidCLI;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"

git clone https://github.com/nahushr/cinecrew-player.git "$env:USERPROFILE\cinecrew-player"
Set-Location "$env:USERPROFILE\cinecrew-player"
npm ci --prefix examples/native-demo
Set-Location examples/native-demo/android
./gradlew.bat assembleRelease --no-daemon
adb install -r app\build\outputs\apk\release\app-release.apk
adb shell monkey -p com.nahushr.cinecrewplayernativedemo 1
```

To rotate the emulator 90° clockwise from PowerShell, run this command. Repeat it to cycle through orientations:

```powershell
adb emu rotate
```

## Electron macOS

The Electron demo uses the same player screen with a LibVLC playback bridge. Install Homebrew, Git, Node.js, and VLC, then build and run it:

```bash
if ! command -v brew >/dev/null 2>&1; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
brew install git node
brew install --cask vlc
git clone https://github.com/nahushr/cinecrew-player.git "$HOME/cinecrew-player"
cd "$HOME/cinecrew-player"
npm ci --prefix examples/electron-demo
npm run dev --prefix examples/electron-demo
```

To build and open the macOS DMG instead of running the development app:

```bash
npm run dist:mac --prefix examples/electron-demo
open examples/electron-demo/release/cinecrew-player-demo.dmg
```

The Windows Electron EXE instructions will be added when the Windows LibVLC packaging path is ready.

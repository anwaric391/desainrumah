$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidDirectory = Join-Path $projectRoot 'android'
$gradleWrapper = Join-Path $androidDirectory 'gradlew.bat'

if (-not (Test-Path $gradleWrapper)) {
  throw 'Proyek Android belum dibuat. Jalankan npm run android:add terlebih dahulu.'
}

$javaCommand = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaCommand) {
  throw 'Java 17 belum ditemukan. Instal JDK 17, atur JAVA_HOME, lalu buka ulang terminal.'
}

$javaVersionOutput = (& java -version 2>&1 | Out-String)
if ($javaVersionOutput -notmatch 'version "?(?<major>\d+)') {
  throw "Versi Java tidak dapat dikenali: $javaVersionOutput"
}
if ([int]$Matches.major -lt 17) {
  throw "Java 17 atau yang lebih baru diperlukan. Versi terdeteksi: $($Matches.major)"
}

$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) {
  $sdkPath = $env:ANDROID_SDK_ROOT
}
if (-not $sdkPath) {
  $localProperties = Join-Path $androidDirectory 'local.properties'
  if (Test-Path $localProperties) {
    $sdkSetting = Select-String -Path $localProperties -Pattern '^sdk\.dir=(.+)$' | Select-Object -First 1
    if ($sdkSetting) {
      $sdkPath = $sdkSetting.Matches[0].Groups[1].Value.Replace('\\', '\')
    }
  }
}
if (-not $sdkPath -or -not (Test-Path $sdkPath)) {
  throw 'Android SDK tidak ditemukan. Instal Android SDK lewat Android Studio, lalu atur ANDROID_HOME atau ANDROID_SDK_ROOT.'
}

& (Join-Path $PSScriptRoot 'generate-android-icons.ps1')

Push-Location $projectRoot
try {
  & node node_modules\vite\bin\vite.js build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & node node_modules\@capacitor\cli\bin\capacitor sync android
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}

Push-Location $androidDirectory
try {
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}

Write-Output "APK: $(Join-Path $androidDirectory 'app\build\outputs\apk\debug\app-debug.apk')"

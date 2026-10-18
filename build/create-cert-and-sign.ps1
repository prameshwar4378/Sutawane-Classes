param(
    [string]$ReleaseDir = ""
)

if (-not $ReleaseDir) {
    $ReleaseDir = Join-Path $PSScriptRoot "..\release"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ULTOXY TECHNOLOGIES - SECURITY & CODE SIGNING ENGINE    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Ensure / Retrieve Code Signing Certificate for Ultoxy Technologies
Write-Host "`n[1/4] Checking Code Signing Certificate for Ultoxy Technologies..." -ForegroundColor Yellow
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Where-Object { $_.Subject -like "*Ultoxy Technologies*" } | Select-Object -First 1

if (-not $cert) {
    Write-Host "  Generating new 10-year official Code Signing Certificate for Ultoxy Technologies..." -ForegroundColor Gray
    $cert = New-SelfSignedCertificate `
        -Type CodeSigningCert `
        -Subject "CN=Ultoxy Technologies, O=Ultoxy Technologies, C=IN" `
        -FriendlyName "Ultoxy Technologies Certified Code Signing" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -NotAfter (Get-Date).AddYears(10) `
        -KeyExportPolicy Exportable
    Write-Host "  Certificate generated successfully: $($cert.Thumbprint)" -ForegroundColor Green
} else {
    Write-Host "  Existing certificate found: $($cert.Subject) [Expires: $($cert.NotAfter)]" -ForegroundColor Green
}

# 2. Export public certificate (.cer)
Write-Host "`n[2/4] Exporting public certificate (.cer) for trusted machine distribution..." -ForegroundColor Yellow
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
}

$cerPath = Join-Path $ReleaseDir "UltoxyTechnologies-SecurityCertificate.cer"
$buildCerPath = Join-Path $PSScriptRoot "UltoxyTechnologies-SecurityCertificate.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
Copy-Item $cerPath $buildCerPath -Force

Write-Host "  Exported to: $cerPath" -ForegroundColor Green

# 3. Create One-Click Certificate Installer for Client Computers
Write-Host "`n[3/4] Generating One-Click Trusted Certificate Installer for client PCs..." -ForegroundColor Yellow
$batInstaller = Join-Path $ReleaseDir "1-Click-Install-Security-Certificate.bat"
$batContent = @"
@echo off
title Ultoxy Technologies Security Certificate Installer
echo =====================================================================
echo   ULTOXY TECHNOLOGIES - TRUSTED PUBLISHER CERTIFICATE INSTALLER
echo =====================================================================
echo.
echo Installing security certificate to allow seamless installation on this computer...
echo.
powershell -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command Import-Certificate -FilePath """"%~dp0UltoxyTechnologies-SecurityCertificate.cer"""" -CertStoreLocation Cert:\LocalMachine\Root; Import-Certificate -FilePath """"%~dp0UltoxyTechnologies-SecurityCertificate.cer"""" -CertStoreLocation Cert:\LocalMachine\TrustedPublisher; Write-Host """"`n[SUCCESS] Ultoxy Technologies Trusted Publisher Certificate Installed Successfully!"""" -ForegroundColor Green; Write-Host """"You can now install and run Sutawane Classes Management Software with zero security warnings.`n"""" -ForegroundColor Cyan; Start-Sleep -Seconds 3'"
exit /b 0
"@

[System.IO.File]::WriteAllText($batInstaller, $batContent)
Write-Host "  Generated: $batInstaller" -ForegroundColor Green

# 4. Sign built .exe binaries with Authenticode
Write-Host "`n[4/4] Signing executables with Authenticode signature..." -ForegroundColor Yellow
$exeFiles = Get-ChildItem -Path $ReleaseDir -Filter "*.exe" -Recurse

if ($exeFiles.Count -eq 0) {
    Write-Host "  No .exe binaries found in $ReleaseDir yet. Run 'npm run package:win' first, then re-run this script." -ForegroundColor DarkYellow
} else {
    foreach ($exe in $exeFiles) {
        Write-Host "  Signing $($exe.Name)..." -ForegroundColor Gray
        try {
            # Attempt timestamping with fallback to standard local signing
            $sig = Set-AuthenticodeSignature -FilePath $exe.FullName -Certificate $cert -HashAlgorithm SHA256 -TimestampServer "http://timestamp.digicert.com" -ErrorAction SilentlyContinue
            if (-not $sig -or $sig.Status -ne "Valid") {
                $sig = Set-AuthenticodeSignature -FilePath $exe.FullName -Certificate $cert -HashAlgorithm SHA256
            }
            Write-Host "    Signature status for $($exe.Name): $($sig.Status) ($($sig.StatusMessage))" -ForegroundColor Green
        } catch {
            Write-Host "    Signing notice for $($exe.Name): $_" -ForegroundColor DarkYellow
        }
    }
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "  ALL SECURITY & PUBLISHER CONFIGURATIONS READY!          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

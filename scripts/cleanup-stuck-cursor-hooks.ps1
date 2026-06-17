# Zabija zawieszone procesy hooków Cursor (deploy-on-aws, convex).
# Bezpieczne: nie dotyka npm run dev / next dev / zwykłych terminali użytkownika.

$patterns = @(
  "validate-drawio",
  "pre-commit-checks"
)

$targets = Get-CimInstance Win32_Process |
  Where-Object {
    $cmd = $_.CommandLine
    if (-not $cmd) { return $false }
    foreach ($pattern in $patterns) {
      if ($cmd -like "*$pattern*") { return $true }
    }
    return $false
  }

if ($targets.Count -eq 0) {
  Write-Host "Brak zawieszonych procesow hookow."
  exit 0
}

Write-Host "Znaleziono $($targets.Count) procesow do zamkniecia:"
$targets | ForEach-Object {
  Write-Host "  PID $($_.ProcessId): $($_.Name) - $($_.CommandLine.Substring(0, [Math]::Min(120, $_.CommandLine.Length)))..."
}

$targets | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Gotowe. Zamknieto $($targets.Count) procesow."

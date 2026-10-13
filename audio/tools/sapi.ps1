# Sintetiza un lote de frases con una voz instalada en Windows (System.Speech) y registra el
# instante de cada palabra. Entrada: JSON [{texto, wav, meta, velocidad}]; salida: WAV 16 kHz mono (frecuencia nativa de la voz; se remuestrea después)
# y JSON con las palabras [{t, c, w}] (segundos, posición de carácter, texto).
param([string]$Lote, [string]$Voz = 'Microsoft Sabina Desktop')
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 $Lote | ConvertFrom-Json
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($it in $items) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice($Voz)
  $s.Rate = [int]$it.velocidad
  $s.Volume = 100
  $s.SetOutputToWaveFile($it.wav, $fmt)
  Get-Event -SourceIdentifier voz -ErrorAction SilentlyContinue | Remove-Event
  Register-ObjectEvent -InputObject $s -EventName SpeakProgress -SourceIdentifier voz | Out-Null
  $s.Speak([string]$it.texto)
  Start-Sleep -Milliseconds 80
  $pal = @(Get-Event -SourceIdentifier voz -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ t = [math]::Round($_.SourceEventArgs.AudioPosition.TotalSeconds, 4); c = $_.SourceEventArgs.CharacterPosition; w = $_.SourceEventArgs.Text } })
  Get-Event -SourceIdentifier voz -ErrorAction SilentlyContinue | Remove-Event
  Unregister-Event -SourceIdentifier voz
  $s.SetOutputToNull(); $s.Dispose()
  ConvertTo-Json -InputObject $pal -Compress | Set-Content -Encoding UTF8 $it.meta
}

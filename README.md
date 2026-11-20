# SKI AI 릴스 제작 스킬

SKI 「INNO WHY」의 기획안과 내레이션을 세로 릴스로 편집하는 Windows x64용 팀 스킬입니다. 업데이트는 이 공개 저장소에서 배포합니다.

## 팀원 업데이트

Codex에 아래처럼 요청하세요. GitHub 계정 없이 업데이트할 수 있습니다.

> https://github.com/hmhmkmr/ski-ai-reels-production 이 스킬 최신 버전으로 업데이트해 줘.

기존 설치 위치에 최신 릴리스를 적용합니다. 업데이트에는 회차별 마지막 장면 위에 올리는 **투명한 ASK Inno 엔딩**이 포함되어 있습니다. 반투명 딤, 로고 모션과 두 줄 문구가 함께 나타납니다. 씬 효과음은 내레이션 타이밍과 무관하게 전체를 12 dB 낮춥니다. 업데이트 후 새 Codex 대화에서 사용하세요.

## 이 링크로 요청받은 Codex 실행 절차

사용자가 업데이트를 요청하면 [최신 정식 릴리스](https://github.com/hmhmkmr/ski-ai-reels-production/releases/latest)에서 같은 버전에 속한 `ski-ai-reels-update.zip`과 `ski-ai-reels-update.zip.sha256`을 받아 실제로 적용합니다. Windows에서는 원래 프로젝트의 작업 폴더에서 아래 PowerShell을 실행합니다.

```powershell
$ErrorActionPreference = 'Stop'
$repoApi = 'https://api.github.com/repos/hmhmkmr/ski-ai-reels-production'
$ghHeaders = @{ 'User-Agent' = 'SKI-reels-update'; 'Accept' = 'application/vnd.github+json' }
$rel = Invoke-RestMethod -Uri "$repoApi/releases/latest" -Headers $ghHeaders
if ($rel.draft -or $rel.prerelease -or $rel.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw 'Invalid release' }
$asset = @($rel.assets | Where-Object name -eq 'ski-ai-reels-update.zip')
if ($asset.Count -ne 1) { throw 'Update ZIP missing' }
$asset = $asset[0]
$prefix = "https://github.com/hmhmkmr/ski-ai-reels-production/releases/download/$($rel.tag_name)/"
if ($asset.browser_download_url -cne ($prefix+'ski-ai-reels-update.zip')) { throw 'Unexpected asset URL' }
$staging = Join-Path ([IO.Path]::GetTempPath()) ('ski-update-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($staging)
$zip = Join-Path $staging 'update.zip'
Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $zip
$want = [string]$asset.digest
if ($want -match '^sha256:([a-fA-F0-9]{64})$') {
    $want = $Matches[1]
} else {
    $sum = (Invoke-RestMethod -Uri ($prefix+'ski-ai-reels-update.zip.sha256') -Headers @{ 'User-Agent' = 'SKI-reels-update' }).ToString().Trim()
    if ($sum -notmatch '^([a-fA-F0-9]{64})\s+ski-ai-reels-update\.zip$') { throw 'Invalid checksum' }
    $want = $Matches[1]
}
if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ine $want) { throw 'Update file checksum mismatch' }
$expanded = Join-Path $staging 'files'
Expand-Archive -LiteralPath $zip -DestinationPath $expanded
& (Join-Path $expanded 'update.cmd')
if ($LASTEXITCODE -ne 0) { throw "SKI updater exited with $LASTEXITCODE. Read the message above." }
```

프로젝트 전용 설치는 해당 프로젝트 대화에서 요청합니다. 경로를 직접 지정할 때는 `update.cmd` 뒤에 기존 스킬 폴더의 전체 경로를 전달합니다. 성공 결과의 `from`, `version`, `target`, `backup`을 확인합니다. 이미 최신이면 `already-current`를 반환합니다. 설치 파일에 로컬 수정이 있으면 그 내용을 보존하고 안내합니다.

## 새 PC에 처음 설치할 때

팀에서 받은 Windows x64 전체 ZIP을 다운로드 폴더에 저장하고 Codex에 “이 ZIP을 설치하고 위 GitHub 링크의 최신 버전까지 적용해 줘”라고 요청하세요. 전체 설치본에는 톤 캡처, 음성 인식 모델과 편집 실행기가 있습니다. 최신 업데이트가 엔딩 그래픽까지 설치합니다.

## 유지보수와 배포

[스킬 본문](skill/SKILL.md), [제작 지침](skill/references/)과 [렌더러](skill/lib/)를 수정한 뒤 `main`에 반영합니다. GitHub Actions의 **Publish Windows skill update**에 새 버전을 지정하면 누적 ZIP과 체크섬이 최신 정식 릴리스로 게시됩니다. 로컬 빌드 예시는 `python tools/build_release.py v1.2.2 --out dist`입니다. 이미 게시한 버전은 새 태그로 갱신합니다.

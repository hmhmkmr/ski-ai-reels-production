# SKI AI 릴스 제작 스킬

SKI 「INNO WHY」의 기획안과 타입캐스트 내레이션을 세로 릴스로 편집하는 Codex 스킬입니다. Windows x64 팀 배포본을 사용합니다.

## 이미 설치하신 분

**Codex에서 이 저장소 링크를 붙이고 “이 스킬 최신 버전으로 업데이트해 줘”라고 말씀해 주세요.** 처음 팀에서 받은 Windows x64 ZIP으로 설치한 분도 같은 방법을 사용합니다. GitHub 로그인이나 Git 설치는 필요하지 않습니다.

> https://github.com/hmhmkmr/ski-ai-reels-production 이 스킬 업데이트해 줘.

Codex가 [최신 정식 릴리스](https://github.com/hmhmkmr/ski-ai-reels-production/releases/latest)를 찾아 기존 설치 위치에 반영합니다. 이미 최신이면 버전을 확인하고 종료합니다. 업데이트 후 새 Codex 대화를 열어 사용하세요. 업데이트할 파일에 직접 수정한 내용이 있으면 보존 후 알려 드립니다.

## 이 링크로 요청받은 Codex 실행 절차

업데이트 요청을 받으면 **실제로 설치까지 진행**합니다. 아래 PowerShell을 사용자의 원래 작업 디렉터리에서 실행합니다. GitHub에서 받은 ZIP의 SHA-256을 확인하고 임시 폴더에 푼 뒤 동봉된 설치 갱신 도구를 실행합니다. 설치본에 있는 실행 도구와 레퍼런스를 그대로 사용합니다.

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

- 현재 프로젝트에서 가장 가까운 `.agents\skills`와 사용자 스킬 폴더를 차례로 찾습니다. 프로젝트 전용 설치는 그 프로젝트의 대화에서 요청하세요. 별도 위치에 설치된 것이 확인되면 마지막 명령에 기존 스킬 폴더의 전체 경로를 인자로 전달합니다.
- 성공 결과의 `from`, `version`, `target`, `backup`을 읽어 적용 여부를 알려 주세요. `already-current`면 추가 작업이 필요 없습니다.
- 기존 스킬은 전체 파일을 대조하고 새 버전은 임시 위치에서 검증한 뒤 교체합니다. 이전 설치 폴더는 결과의 `backup` 위치에 남습니다. 회차별 영상과 작업 폴더를 수정하지 않습니다.

## 새 PC에 처음 설치할 때

팀에서 받은 **Windows x64 전체 ZIP**을 다운로드 폴더에 저장하고 Codex에 “이 ZIP을 설치하고 위 GitHub 링크의 최신 버전까지 적용해 줘”라고 요청하세요. 전체 설치본에는 톤 캡처, 브랜드 자산, 음성 인식 모델과 편집 실행기가 있습니다. 이 공개 저장소에서는 제작 코드와 업데이트를 배포합니다.

## 스킬을 수정하고 배포할 때

1. [스킬 본문](skill/SKILL.md), [제작 지침](skill/references/) 또는 [편집 도구](skill/lib/)를 수정해 `main`에 반영합니다.
2. GitHub Actions의 **Publish Windows skill update**에서 다음 버전(예: `v1.1.1`)을 입력해 실행합니다. 같은 버전은 덮어쓸 수 없습니다. 릴리스에는 누적 업데이트 ZIP과 SHA-256이 첨부됩니다. 새 버전은 최종 게시 후에만 팀원에게 보입니다.
3. 팀원에게 같은 저장소 링크를 알려 주세요. 중간 버전을 건너뛴 PC도 최신 정식 릴리스를 바로 적용할 수 있습니다.

로컬 빌드는 `python tools/build_release.py v1.1.1 --out dist`입니다. 초기 Windows 배포본의 파일 해시는 `distribution/base.json`에 있습니다. 제거할 관리 파일은 `distribution/removed.json`에 명시합니다. 이미 배포했던 파일을 이전 내용으로 되돌릴 때도 해당 파일을 `skill/`에 둡니다. 대형 자산을 공개 배포하는 변경은 해당 자산의 배포 범위를 먼저 확인하세요.


# SKI AI 릴스 제작 스킬 설치

Codex 데스크톱이 설치된 Windows 10/11 x64용입니다. 영상 편집 도구, 한국어 음성 인식 모델, 톤 참조 이미지 98장, 자막 서체, ASK Inno 로고가 들어 있습니다.

## 설치

1. ZIP을 다운로드 폴더에 저장합니다.
2. Codex 데스크톱에서 “다운로드 폴더의 SKI AI 릴스 제작 Windows x64.zip을 풀어서 내 Codex에 설치해 줘”라고 입력합니다. 에이전트는 ZIP을 로컬 폴더에 풀고, 스킬 폴더의 `reels.cmd install`을 실행합니다. 직접 설치하려면 ZIP을 모두 푼 뒤 `install.cmd`를 두 번 클릭합니다.
3. 설치 후 Codex에서 새 대화를 엽니다. 기획안 PPTX와 타입캐스트 음성 파일을 첨부하고 “두 파일로 $ski-ai-reels-production 스킬을 사용해 릴스를 제작해 줘”라고 요청합니다.
4. AI 키프레임과 씬 영상 생성에는 인터넷과 해당 계정의 생성 권한이 필요합니다. Higgsfield를 처음 사용한다면 [공식 연결 페이지](https://higgsfield.ai/mcp)에서 본인 계정을 연결합니다.

스킬의 제작 절차는 [SKILL.md](SKILL.md), 명령과 타임라인 예시는 [편집 도구 안내](references/local-tools.md)에서 확인할 수 있습니다. 로컬 음성 인식과 편집에는 Python, FFmpeg, 서체를 별도로 설치할 필요가 없습니다.

기본 설치 위치는 `%USERPROFILE%\.codex\skills\ski-ai-reels-production`입니다. 사용자 지정 CODEX_HOME을 지원합니다. 기본 설치 시 사용자 프로필의 `.agents\skills`에도 같은 스킬의 발견 경로를 연결합니다. 프로젝트 한 곳에만 설치하려면 `reels.cmd install --project "프로젝트 경로"`를 사용합니다. 다른 버전의 동명 스킬이 있으면 기존 폴더를 보존하고 알려 줍니다. 설치 후 `reels.cmd doctor`로 도구와 자료를 확인할 수 있습니다.

## 다음 버전 받기

이미 설치한 PC에서는 Codex에 “https://github.com/hmhmkmr/ski-ai-reels-production 이 스킬 업데이트해 줘”라고 요청한다. 설치된 대형 자산은 그대로 사용하며 업데이트 후 새 대화를 연다.

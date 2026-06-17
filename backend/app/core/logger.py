# logger.py
# 애플리케이션 전역 로깅 설정 파일입니다.
# TODO: 로그 포맷, 로그 레벨, 파일 핸들러 등 구성

import logging

logger = logging.getLogger("maeumgyeol")
logger.setLevel(logging.INFO)

# TODO: 핸들러(StreamHandler/FileHandler) 및 포맷터 추가

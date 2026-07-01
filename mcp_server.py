"""마음이 민원 챗봇 MCP 서버 (Claude Desktop용)

chatbot_service의 함수들을 MCP 프로토콜로 노출.
백엔드는 chatbot_service를 직접 import하면 되며 이 파일은 호출하지 않음.

도구 8개:
  - classify_complaint              민원 텍스트 → 11 카테고리 분류
  - check_urgency                   긴급 여부 판정
  - search_laws                     법령 조항 벡터 검색
  - search_cases                    유사 사례 검색 (적재 시)
  - search_dept                     부서 의미 검색 (category_id 필터 가능)
  - match_or_create_cluster         유사 민원 그룹화 + urgency_bonus
  - lookup_dept_by_category         카테고리 → 부서 priority 순
  - get_categories                  11 카테고리 메타

Claude Desktop 등록 (~/AppData/Roaming/Claude/claude_desktop_config.json):
  {
    "mcpServers": {
      "minwon-chatbot": {
        "command": "C:\\Users\\smhrd\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
        "args": ["C:\\path\\to\\ai\\mcp_server.py"]
      }
    }
  }
"""
import asyncio
import json
import sys
from typing import Any

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
import mcp.types as types

# 비즈니스 로직은 모두 chatbot_service에서
import chatbot_service as svc


server = Server('minwon-chatbot')


@server.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name='classify_complaint',
            description=(
                '민원 텍스트를 11개 카테고리로 분류 (교통/건축/행정/보건위생/환경/문화_여가/'
                '농축산/복지/세무/상하수도/경제). top-K + confidence + category_id 반환. '
                'top-1 confidence < 0.7이면 top-2/3까지 RAG 검색 권장.'
            ),
            inputSchema={
                'type': 'object',
                'properties': {
                    'text': {'type': 'string', 'description': '민원 본문'},
                    'top_k': {'type': 'integer', 'default': 3},
                },
                'required': ['text'],
            },
        ),
        types.Tool(
            name='check_urgency',
            description=(
                '민원의 긴급 여부. KLUE BERT 이진 분류 + DB 키워드 매칭 + 예외룰. '
                'is_urgent=true면 119/112/안전신문고 우선 안내.'
            ),
            inputSchema={
                'type': 'object',
                'properties': {'text': {'type': 'string'}},
                'required': ['text'],
            },
        ),
        types.Tool(
            name='search_laws',
            description=(
                '관련 법령 조항 검색. 26개 법령에서 조항 단위로 벡터 RAG. '
                'category_id 필터 가능 (1~11). 답변 시 근거 법령으로 인용.'
            ),
            inputSchema={
                'type': 'object',
                'properties': {
                    'query': {'type': 'string'},
                    'category_id': {'type': 'integer'},
                    'limit': {'type': 'integer', 'default': 5},
                },
                'required': ['query'],
            },
        ),
        types.Tool(
            name='search_cases',
            description='국민신문고 유사 사례 검색 (질문+공식답변). category_id 필터 가능.',
            inputSchema={
                'type': 'object',
                'properties': {
                    'query': {'type': 'string'},
                    'category_id': {'type': 'integer'},
                    'limit': {'type': 'integer', 'default': 5},
                },
                'required': ['query'],
            },
        ),
        types.Tool(
            name='search_dept',
            description=(
                '부서 의미 검색 (담당업무 description 기반). '
                'category_id를 주면 해당 카테고리 매핑 부서 안에서만 검색 (정밀도 ↑). '
                'None이면 39개 부서 전체에서 검색 (카테고리 매핑 없는 소방본부 등 포함). '
                '권장: classify_complaint으로 카테고리 먼저 받고 category_id로 좁혀서 호출.'
            ),
            inputSchema={
                'type': 'object',
                'properties': {
                    'query': {'type': 'string'},
                    'category_id': {'type': 'integer', 'description': '카테고리 필터 1~11 (선택)'},
                    'limit': {'type': 'integer', 'default': 5},
                },
                'required': ['query'],
            },
        ),
        types.Tool(
            name='match_or_create_cluster',
            description=(
                '비슷한 민원 그룹(클러스터)을 찾거나 신규 생성. '
                '백엔드가 민원 INSERT 시 호출 → 반환된 cluster_id를 complaints.cluster_id에 저장. '
                'complaint_count가 임계치(10/50/100) 넘으면 urgency_bonus 가산점 반환 → urgency_score에 더하기.'
            ),
            inputSchema={
                'type': 'object',
                'properties': {
                    'text': {'type': 'string', 'description': '민원 본문'},
                    'similarity_threshold': {'type': 'number', 'default': 0.75},
                },
                'required': ['text'],
            },
        ),
        types.Tool(
            name='lookup_dept_by_category',
            description='카테고리 → 처리 부서 (priority 순).',
            inputSchema={
                'type': 'object',
                'properties': {'category_id': {'type': 'integer'}},
                'required': ['category_id'],
            },
        ),
        types.Tool(
            name='get_categories',
            description='11개 카테고리 메타 (category_id, name).',
            inputSchema={'type': 'object', 'properties': {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[types.TextContent]:
    def reply(data):
        return [types.TextContent(type='text', text=json.dumps(data, ensure_ascii=False))]
    try:
        if name == 'classify_complaint':
            return reply(svc.classify_complaint(arguments.get('text', ''), int(arguments.get('top_k', 3))))
        elif name == 'check_urgency':
            return reply(svc.check_urgency(arguments.get('text', '')))
        elif name == 'search_laws':
            return reply(svc.search_laws(
                arguments.get('query', ''),
                arguments.get('category_id'),
                int(arguments.get('limit', 5)),
            ))
        elif name == 'search_cases':
            return reply(svc.search_cases(
                arguments.get('query', ''),
                arguments.get('category_id'),
                int(arguments.get('limit', 5)),
            ))
        elif name == 'search_dept':
            cat = arguments.get('category_id')
            return reply(svc.search_dept(
                arguments.get('query', ''),
                int(cat) if cat else None,
                int(arguments.get('limit', 5)),
            ))
        elif name == 'match_or_create_cluster':
            return reply(svc.match_or_create_cluster(
                arguments.get('text', ''),
                float(arguments.get('similarity_threshold', 0.75)),
            ))
        elif name == 'lookup_dept_by_category':
            return reply(svc.lookup_dept_by_category(int(arguments.get('category_id', 0))))
        elif name == 'get_categories':
            return reply(svc.get_categories())
        else:
            return reply({'error': f'unknown tool: {name}'})
    except Exception as e:
        import traceback
        return reply({'error': str(e), 'traceback': traceback.format_exc()[-500:]})


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream, write_stream,
            InitializationOptions(
                server_name='minwon-chatbot',
                server_version='1.0.0',
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == '__main__':
    asyncio.run(main())

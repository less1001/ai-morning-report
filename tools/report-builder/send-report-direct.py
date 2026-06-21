import sys
import os
import re
import json
import urllib.request
import urllib.parse
import base64
import subprocess
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import markdown

# Google OAuth Credentials (loaded from env)
TO_EMAIL = "vkdefi@gmail.com"
FROM_EMAIL = "vkdefi@gmail.com"

PROJECT_ROOT = "/Volumes/Samsung T7/Codex/Legacy Projects/New project 4"

def load_env():
    env_vars = {}
    env_path = "/Users/nemo/.hermes/.env"
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def run_cmd(args, cwd=PROJECT_ROOT):
    print(f"Running command: {' '.join(args)} in {cwd}")
    res = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error executing command: {res.stderr}")
        raise subprocess.CalledProcessError(res.returncode, args, output=res.stdout, stderr=res.stderr)
    return res.stdout

def call_deepseek(prompt, api_key):
    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "system", 
                "content": (
                    "你是一个专业的科技媒体编辑，负责撰写类似36kr风格的《AI出海机会与素材简报》。\n"
                    "请严格遵守排版规范：\n"
                    "1. 中文与英文单词、数字、半角英文符号之间绝对不能有任何空格。例如，必须写成'6月21日'、'Gemini模型'，不可写成'6月21日'或'Gemini模型'带有空格的形式。\n"
                    "2. 严禁在中文文本中使用任何中英文圆括号、花括号或方括号对英文单词、缩写或术语进行解释。例如，直接写'Nowadays企业活动平台'，决不能写成包含圆括号的结构。所有要表达的说明信息必须直接融入句子本身中，不可以使用任何括号。\n"
                    "3. 严禁在段落或文章结尾写'总结'、'结论'或'总而言之'这类总结性词汇。\n"
                    "4. 全文除了Markdown链接的括号格式外，其他地方绝对不能出现任何半角或全角括号。"
                )
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=90) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["choices"][0]["message"]["content"]

def call_gemini(prompt, api_key, model="gemini-2.0-flash"):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    headers = {
        "Content-Type": "application/json"
    }
    system_instruction = (
        "你是一个专业的科技媒体编辑，负责撰写类似36kr风格的《AI出海机会与素材简报》。\n"
        "请严格遵守排版规范：\n"
        "1. 中文与英文单词、数字、半角英文符号之间绝对不能有任何空格。例如，必须写成'6月21日'、'Gemini模型'，不可写成'6月21日'或'Gemini模型'带有空格的形式。\n"
        "2. 严禁在中文文本中使用任何中英文圆括号、花括号或方括号对英文单词、缩写或术语进行解释。例如，直接写'Nowadays企业活动平台'，决不能写成包含圆括号的结构。所有要表达的说明信息必须直接融入句子本身中，不可以使用任何括号。\n"
        "3. 严禁在段落或文章结尾写'总结'、'结论'或'总而言之'这类总结性词汇。\n"
        "4. 全文除了Markdown链接的括号格式外，其他地方绝对不能出现任何半角或全角括号。"
    )
    data = {
        "contents": [{
            "parts": [{
                "text": system_instruction + "\n\n" + prompt
            }]
        }],
        "generationConfig": {
            "temperature": 0.3
        }
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=90) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["candidates"][0]["content"]["parts"][0]["text"]

def request_llm(prompt, env_vars):
    # Try DeepSeek first
    deepseek_key = env_vars.get("DEEPSEEK_API_KEY")
    if deepseek_key:
        try:
            print("Trying DeepSeek API for summarization...")
            return call_deepseek(prompt, deepseek_key)
        except Exception as e:
            print(f"DeepSeek API failed: {e}. Falling back to Gemini...")
    
    # Fallback to Gemini
    gemini_key = env_vars.get("GEMINI_API_KEY")
    if gemini_key:
        for model in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]:
            try:
                print(f"Trying Gemini {model} API...")
                return call_gemini(prompt, gemini_key, model=model)
            except Exception as e:
                print(f"Gemini {model} failed: {e}")
        raise RuntimeError("All Gemini models failed.")
    
    raise RuntimeError("No valid DeepSeek or Gemini API keys found.")

def refresh_oauth_token(client_id, client_secret, refresh_token):
    url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    req_data = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, method="POST")
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))
        return res["access_token"]

def send_gmail_api(access_token, html_content, subject):
    msg = MIMEMultipart("alternative")
    msg["From"] = FROM_EMAIL
    msg["To"] = TO_EMAIL
    msg["Subject"] = subject
    
    # Create HTML mime entity
    msg.attach(MIMEText(html_content, "html", "utf-8"))
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    req_body = json.dumps({"raw": raw_message}).encode("utf-8")
    req = urllib.request.Request(
        url, 
        data=req_body, 
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode("utf-8"))
        return res

def clean_text_formatting(text):
    # 1. Temporarily extract and mask markdown links to protect them from replacement
    links = []
    def mask_link(match):
        links.append(match.group(0))
        return f"__MARKDOWN_LINK_{len(links)-1}__"
    
    # Matches [text](url) and ![alt](url)
    text_masked = re.sub(r'!?\[[^\]]*\]\([^\s)]+\)', mask_link, text)
    
    # 2. Remove spaces between Chinese characters and English/digits
    # Chinese -> English/digit
    text_masked = re.sub(r'([\u4e00-\u9fff])\s+([a-zA-Z0-9])', r'\1\2', text_masked)
    # English/digit -> Chinese
    text_masked = re.sub(r'([a-zA-Z0-9])\s+([\u4e00-\u9fff])', r'\1\2', text_masked)
    
    # 3. Clean all parentheses (full-width and half-width)
    # We remove the parentheses and keep the text inside.
    # e.g., ChatGPT（由OpenAI开发） -> ChatGPT由OpenAI开发
    text_masked = text_masked.replace("（", "").replace("）", "")
    text_masked = re.sub(r'\(([^)]*)\)', r'\1', text_masked)
    
    # 4. Restore the masked markdown links
    def restore_link(match):
        idx = int(match.group(1))
        return links[idx]
    
    final_text = re.sub(r'__MARKDOWN_LINK_(\d+)__', restore_link, text_masked)
    return final_text

def main():
    print("Step 1: Running monitor refresh to scrape latest data...")
    # Run preview mode refresh to generate public/report-candidates.json
    run_cmd(["node", "tools/monitor-refresh.mjs"])
    
    candidates_file = os.path.join(PROJECT_ROOT, "tools/report-builder/data/candidates.json")
    if not os.path.exists(candidates_file):
        raise FileNotFoundError(f"Candidates file not found at: {candidates_file}")
        
    print("Step 2: Loading candidates JSON data...")
    with open(candidates_file, "r", encoding="utf-8") as f:
        payload = json.load(f)
        
    # Group candidates by source_type to ensure all sources are covered
    all_candidates = payload.get("candidates", [])
    candidates_by_source = {}
    for c in all_candidates:
        stype = c.get("source_type", "other")
        if stype not in candidates_by_source:
            candidates_by_source[stype] = []
        candidates_by_source[stype].append(c)
        
    source_types = ["wechat", "x", "product_hunt", "reddit", "one_ms_yc", "one_ms_hn", "news", "podcast", "youtube"]
    candidates = []
    # Pick top 4 from each source type to ensure broad coverage
    for stype in source_types:
        items = candidates_by_source.get(stype, [])
        selected_items = items[:4]
        candidates.extend(selected_items)
        if selected_items:
            print(f"Selected {len(selected_items)} candidates from source type: {stype}")
            
    if not candidates:
        print("No candidates selected. Exiting...")
        return
        
    # Use Beijing Time (UTC+8) to align date string for filenames and email subject
    tz_beijing = timezone(timedelta(hours=8))
    date_str = datetime.now(tz_beijing).strftime("%Y-%m-%d")
    
    # Construct the candidate text for LLM prompting
    cand_list = []
    for i, c in enumerate(candidates):
        cand_list.append({
            "index": i + 1,
            "title": c.get("title", ""),
            "url": c.get("url", ""),
            "source": c.get("source", ""),
            "source_type": c.get("source_type", ""),
            "published_at": c.get("published_at", ""),
            "summary": c.get("summary", ""),
            "tags": c.get("tags", [])
        })
    
    prompt = (
        "请将以下AI出海候选动态进行筛选、分类并重新撰写为简报。\n\n"
        f"数据内容：\n{json.dumps(cand_list, ensure_ascii=False, indent=2)}\n\n"
        "请务必选出最重要、互动最高、信息最实的12-18条动态，并按照以下三个板块组织Markdown输出，各版块下直接排版具体新闻，不要加多余段落：\n"
        "### 一、AI编程与智能体前沿\n"
        "汇聚大厂动态、AI编程工具、Agent框架等内容\n\n"
        "### 二、出海工具与商业化案例\n"
        "汇聚独立站、微型SaaS、YC发布产品、变现与收入案例等内容\n\n"
        "### 三、社区热议与内容素材\n"
        "汇聚X与Reddit上的高热讨论、自媒体选题素材等内容\n\n"
        "对于每条动态，必须输出以下格式，且属性和正文前必须严格缩进四个空格以实现嵌套：\n"
        "1. **[中文提炼标题]**\n"
        "    - 来源：[来源名称] / 时间：[发表时间]\n"
        "    - 内容：[用100-200字写出核心事实、为什么重要、可执行启发。]\n"
        "    - 原文链接：[原始URL]\n\n"
        "排版规范约束：\n"
        "- 中英文与数字边界绝不能有任何空格。\n"
        "- 严禁使用任何括号解释英文、缩写或进行词义补充说明。\n"
        "- 正文不要带有总结、结论、总而言之等段落。\n"
        "- 除了Markdown链接格式的括号外，其余任何文字均不得出现半角或全角圆括号。"
    )
    
    env_vars = load_env()
    print("Step 3: Generating briefing with LLM API...")
    brief_md = request_llm(prompt, env_vars)
    
    print("Step 4: Cleaning text formatting (enforcing Chinese spacing and explanation constraints)...")
    brief_md = clean_text_formatting(brief_md)
    
    # Render Markdown to HTML
    print("Step 5: Converting briefing to HTML...")
    # Enable markdown extensions like extra and tables
    body_html = markdown.markdown(brief_md, extensions=['extra', 'tables'])
    
    email_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333333;
        background-color: #f4f6f8;
        margin: 0;
        padding: 20px;
    }}
    .container {{
        max-width: 680px;
        margin: 0 auto;
        background-color: #ffffff;
        padding: 30px 40px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
        border: 1px solid #e1e4e8;
    }}
    h1 {{
        font-size: 26px;
        color: #1a1a1a;
        margin-top: 0;
        margin-bottom: 20px;
        border-bottom: 2px solid #eaeaea;
        padding-bottom: 12px;
        font-weight: 700;
        letter-spacing: -0.5px;
    }}
    h2 {{
        font-size: 19px;
        color: #0366d6;
        margin-top: 32px;
        margin-bottom: 16px;
        border-left: 4px solid #0366d6;
        padding-left: 12px;
        font-weight: 600;
    }}
    h3 {{
        font-size: 17px;
        color: #0366d6;
        margin-top: 24px;
        margin-bottom: 12px;
        border-bottom: 1px solid #eaeaea;
        padding-bottom: 6px;
    }}
    p {{
        font-size: 15px;
        margin-top: 0;
        margin-bottom: 16px;
        color: #24292e;
    }}
    a {{
        color: #0366d6;
        text-decoration: none;
        font-weight: 500;
    }}
    a:hover {{
        text-decoration: underline;
    }}
    hr {{
        height: 1px;
        padding: 0;
        margin: 24px 0;
        background-color: #e1e4e8;
        border: 0;
    }}
    ul, ol {{
        padding-left: 20px;
        margin-top: 0;
        margin-bottom: 16px;
    }}
    li {{
        font-size: 15px;
        margin-bottom: 8px;
        color: #24292e;
    }}
    strong {{
        color: #111111;
        font-weight: 600;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin: 24px 0;
        font-size: 14px;
    }}
    th, td {{
        border: 1px solid #dfe2e5;
        padding: 10px 12px;
        text-align: left;
    }}
    th {{
        background-color: #f6f8fa;
        font-weight: 600;
    }}
    tr:nth-child(even) {{
        background-color: #f8fafc;
    }}
    blockquote {{
        padding: 0 1em;
        color: #6a737d;
        border-left: 0.25em solid #dfe2e5;
        margin: 0 0 16px 0;
    }}
</style>
</head>
<body>
    <div class="container">
        {body_html}
    </div>
</body>
</html>
"""

    subject = f"AI出海机会与素材简报｜{date_str} BJT"
    
    print("Step 6: Refreshing Gmail OAuth token...")
    client_id = env_vars.get("GMAIL_CLIENT_ID")
    client_secret = env_vars.get("GMAIL_CLIENT_SECRET")
    refresh_token = env_vars.get("GMAIL_REFRESH_TOKEN")
    
    if not all([client_id, client_secret, refresh_token]):
        raise RuntimeError("Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN in env file.")
        
    access_token = refresh_oauth_token(client_id, client_secret, refresh_token)
    
    print("Step 7: Sending email to recipient...")
    res = send_gmail_api(access_token, email_html, subject)
    print(f"Gmail Send Result: {res}")
    
    # On success, commit the candidates as seen and perform git sync
    print("Step 8: Committing candidates and generating asset pack...")
    run_cmd(["node", "tools/report-builder/report-builder.mjs", "--commit"])
    
    # Sync LLM generated brief to the public archives
    public_brief_path = os.path.join(PROJECT_ROOT, "public/brief.md")
    archive_brief_path = os.path.join(PROJECT_ROOT, f"public/archive/brief-{date_str}.md")
    
    print(f"Syncing LLM brief to {public_brief_path} and {archive_brief_path}...")
    with open(public_brief_path, "w", encoding="utf-8") as f:
        f.write(brief_md)
    with open(archive_brief_path, "w", encoding="utf-8") as f:
        f.write(brief_md)
        
    run_cmd(["npm", "run", "asset:generate"])
    
    print("Step 9: Syncing changes to Git repository...")
    run_cmd(["git", "add", "."])
    # Ignore git error if everything is already up to date
    try:
        commit_msg = f"Generate and commit AI Morning Report for {date_str} (Beijing Time)"
        run_cmd(["git", "commit", "-m", commit_msg])
        run_cmd(["git", "push", "origin"])
        print("Git push completed successfully!")
    except Exception as e:
        print(f"Git commit/push skipped or failed: {e}")
        
    print("Morning Report Automation Run Completed Successfully!")

if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
import sys
import os
import re
import json
import warnings
warnings.filterwarnings('ignore')

try:
    import pymupdf as fitz
except ImportError:
    import fitz

PATCH_FILE = os.path.join(os.path.dirname(__file__), 'ab100_patches.json')
AB100_PATCHES = {}
if os.path.exists(PATCH_FILE):
    try:
        with open(PATCH_FILE, 'r', encoding='utf-8') as f:
            AB100_PATCHES = json.load(f)
    except Exception:
        pass

def clean_text(text):
    lines = text.splitlines()
    clean_lines = []
    for line in lines:
        l = line.strip()
        if 'Get Latest & Actual AB-100 Exam' in l or 'https://www.passleader.com' in l:
            continue
        if re.match(r'^\d+$', l):
            continue
        clean_lines.append(line)
    return '\n'.join(clean_lines)

def sanitize_prompt(raw):
    if not raw:
        return ''
    p = raw.strip()
    p = re.sub(r'^QUESTION\s+\d+\s*', '', p, flags=re.IGNORECASE)
    p = re.sub(r'^(?:Drag and Drop Question|Hotspot Question)\s*', '', p, flags=re.IGNORECASE)
    p = re.sub(r'^Case Study\s*\d+[^\n]*\n*', '', p, flags=re.IGNORECASE)
    p = re.sub(r'\s*To answer,?\s*(?:drag|select)[\s\S]*$', '', p, flags=re.IGNORECASE)
    p = re.sub(r'\s*NOTE:\s*Each correct selection is worth one point\.?[\s\S]*$', '', p, flags=re.IGNORECASE)
    return p.strip()

def parse_pdf(pdf_path, output_dir=None):
    doc = fitz.open(pdf_path)
    
    # 1. Extract Exam Info from first 3 pages
    exam_info = {
        'vendor': 'Microsoft',
        'code': 'EXAM',
        'title': 'Certification Exam'
    }
    
    header_text = ''
    for p in range(min(3, len(doc))):
        header_text += doc[p].get_text() + '\n'
        
    v_match = re.search(r'Vendor:\s*([^\n]+)', header_text)
    if v_match: exam_info['vendor'] = v_match.group(1).strip()
    
    c_match = re.search(r'Exam Code:\s*([^\n]+)', header_text)
    if c_match: exam_info['code'] = c_match.group(1).strip().replace(' ', '')
    
    t_match = re.search(r'Exam Name:\s*([^\n]+)', header_text)
    if t_match: exam_info['title'] = t_match.group(1).strip()

    # 2. Extract full clean text with page markers
    full_text = ''
    for p_no in range(len(doc)):
        page = doc[p_no]
        p_text = clean_text(page.get_text())
        full_text += f"\n<<<PAGE_{p_no+1}>>>\n" + p_text

    # 3. Identify all QUESTION <num> anchors
    q_matches = list(re.finditer(r'QUESTION\s+(\d+)', full_text))
    if not q_matches:
        raise ValueError("Could not find any 'QUESTION <num>' blocks in the PDF.")

    questions = []
    current_case_study = {
        'title': '',
        'background': ''
    }

    for i in range(len(q_matches)):
        start = q_matches[i].start()
        end = q_matches[i+1].start() if i+1 < len(q_matches) else len(full_text)
        block = full_text[start:end].strip()
        qnum = int(q_matches[i].group(1))

        # Check for Case Study header
        cs_match = re.search(r'Case Study\s+(\d+)\s*-\s*([^\n]+)', block, re.IGNORECASE)
        if cs_match:
            current_case_study['title'] = f"Case Study {cs_match.group(1)}: {cs_match.group(2).strip()}"

        clean_block = re.sub(r'<<<PAGE_\d+>>>\n?', '', block)

        # Detect question type across entire block
        is_hotspot = bool(re.search(r'\bhotspot\s*question\b', clean_block, re.IGNORECASE))
        is_dragdrop = bool(re.search(r'\bdrag\s*and\s*drop\s*question\b', clean_block, re.IGNORECASE))
        is_case_study = bool(cs_match) or bool(re.search(r'\bcase\s*study\b', clean_block, re.IGNORECASE))

        # Extract Answer, Explanation, Reference
        ans_match = re.search(r'\nAnswer:\s*([^\n]*)', clean_block)
        ans_text = ans_match.group(1).strip() if ans_match else ''

        exp_match = re.search(r'\nExplanation:\s*([\s\S]*?)(?=\nReference:|\nQUESTION\s+\d+|$)', clean_block)
        explanation = exp_match.group(1).strip() if exp_match else ''

        ref_match = re.search(r'\nReference:\s*([\s\S]*?)(?=\nQUESTION\s+\d+|$)', clean_block)
        reference = ref_match.group(1).strip() if ref_match else ''
        if reference and explanation:
            explanation = explanation + '\n\nReference:\n' + reference
        elif reference and not explanation:
            explanation = 'Reference:\n' + reference

        q_data = {
            'qnum': qnum,
            'topic': exam_info['code'],
            'difficulty': 'medium',
            'points': 1,
            'question_type': 'single_choice',
            'question_text': '',
            'question_description': '',
            'answer_options': [],
            'correct_answer': '',
            'answer_explanation': explanation,
            'status': 'published'
        }

        # Handle Case Study Scenario Extraction
        if is_case_study:
            q_data['question_type'] = 'case_study'
            bg_match = re.search(r'(?:Case\s*Study[\s\S]*?)?(Background|Overview)([\s\S]*?)(?=\n(?:Which|What|How|You need|Select|Hotspot|Drag and Drop|\n[A-F]\.))', clean_block, re.IGNORECASE)
            if bg_match:
                q_data['question_description'] = f"**{current_case_study.get('title', 'Case Study')}**\n\n{bg_match.group(1).strip()}{bg_match.group(2).strip()}"
            elif current_case_study.get('title'):
                q_data['question_description'] = f"**{current_case_study['title']}**"

        pre_ans = clean_block[:ans_match.start()] if ans_match else clean_block
        opt_matches = list(re.finditer(r'\n([A-F])\.\s+([^\n]+(?:\n(?![A-F]\.|\nAnswer:)[\t ]+[^\n]+)*)', pre_ans))

        if is_hotspot or ('select the appropriate options in the answer area' in pre_ans.lower()):
            q_data['question_type'] = 'hotspot'
            prompt_match = re.search(r'(?:Hotspot Question\s*)?([\s\S]*?)(?=\s*To answer|\s*NOTE:|\s*Answer:)', pre_ans)
            prompt = prompt_match.group(1).strip() if prompt_match else pre_ans.strip()
            if q_data['question_description']:
                prompt = re.sub(r'^Case Study[\s\S]*?(?=(?:You need|Which|What|A company|Fabrikam|An organization))', '', prompt, flags=re.IGNORECASE).strip()
            q_data['question_text'] = sanitize_prompt(prompt) or f"Question {qnum}"

            boxes = re.findall(r'Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?', explanation)
            statements = []
            correct_keys = {}
            if boxes:
                for b in boxes:
                    box_num = b[0]
                    correct_val = b[1].strip()
                    desc = b[2].strip() if len(b) > 2 and b[2] else f"Requirement / Area {box_num}"
                    stmt_id = f"stmt_{box_num}"
                    statements.append({
                        'id': stmt_id,
                        'statement': f"{desc}: {correct_val}" if 'statement' in desc.lower() else desc,
                        'options': ['Yes', 'No'] if correct_val.lower() in ['yes', 'no'] else [correct_val]
                    })
                    correct_keys[stmt_id] = correct_val
            
            if not statements:
                statements = [
                    {'id': 'stmt_1', 'statement': 'Select appropriate option in Answer Area', 'options': ['Yes', 'No']}
                ]
                correct_keys = {'stmt_1': 'Yes'}

            q_data['answer_options'] = statements
            q_data['correct_answer'] = correct_keys
            q_data['partial_credit'] = True

        elif is_dragdrop or ('drag the appropriate options' in pre_ans.lower()):
            q_data['question_type'] = 'matching'
            prompt_match = re.search(r'(?:Drag and Drop Question\s*)?([\s\S]*?)(?=\s*To answer|\s*NOTE:|\s*Answer:)', pre_ans)
            prompt = prompt_match.group(1).strip() if prompt_match else pre_ans.strip()
            if q_data['question_description']:
                prompt = re.sub(r'^Case Study[\s\S]*?(?=(?:You need|Which|What|A company|Fabrikam|An organization))', '', prompt, flags=re.IGNORECASE).strip()
            q_data['question_text'] = sanitize_prompt(prompt) or f"Question {qnum}"

            boxes = re.findall(r'Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?', explanation)
            sources = []
            targets = []
            correct_map = {}
            if boxes:
                for b in boxes:
                    box_num = b[0]
                    src_val = b[1].strip()
                    tgt_desc = b[2].strip() if len(b) > 2 and b[2] else f"Target Slot #{box_num}"
                    src_id = f"src_{box_num}"
                    tgt_id = f"tgt_{box_num}"
                    sources.append({'id': src_id, 'text': src_val})
                    targets.append({'id': tgt_id, 'text': tgt_desc, 'correct_source_id': src_id})
                    correct_map[tgt_id] = src_id
            else:
                sources = [{'id': 'src_1', 'text': 'Option 1'}, {'id': 'src_2', 'text': 'Option 2'}]
                targets = [{'id': 'tgt_1', 'text': 'Requirement 1', 'correct_source_id': 'src_1'}]
                correct_map = {'tgt_1': 'src_1'}

            q_data['answer_options'] = {
                'source_title': 'Options',
                'target_title': 'Requirements / Answer Area',
                'sources': sources,
                'targets': targets,
                'pairs': [{'source_id': s['id'], 'target_id': t['id']} for s, t in zip(sources, targets)]
            }
            q_data['correct_answer'] = correct_map
            q_data['partial_credit'] = True

        elif opt_matches:
            prompt_text = pre_ans[:opt_matches[0].start()].strip()
            prompt_text = re.sub(r'^QUESTION\s+\d+\s*', '', prompt_text)
            if is_case_study:
                q_last_match = re.search(r'((?:Which|What|How|You need|Select|Where|Why)[\s\S]*?\?)\s*$', prompt_text, re.IGNORECASE)
                if q_last_match:
                    prompt_text = q_last_match.group(1).strip()
                else:
                    lines = [ln.strip() for ln in prompt_text.splitlines() if ln.strip()]
                    prompt_text = lines[-1] if lines else prompt_text

            q_data['question_text'] = sanitize_prompt(prompt_text) or f"Question {qnum}"

            options_list = []
            for om in opt_matches:
                letter = om.group(1).strip()
                otext = re.sub(r'\s+', ' ', om.group(2)).strip()
                options_list.append({'id': letter, 'text': otext})
            q_data['answer_options'] = options_list

            letters = re.findall(r'[A-F]', ans_text)
            if len(letters) > 1:
                q_data['question_type'] = 'multiple_response'
                q_data['correct_answer'] = letters
                q_data['required_selection_count'] = len(letters)
                q_data['partial_credit'] = True
            elif len(letters) == 1:
                q_data['question_type'] = 'case_study' if is_case_study else 'single_choice'
                q_data['correct_answer'] = letters[0]
            else:
                q_data['question_type'] = 'single_choice'
                q_data['correct_answer'] = options_list[0]['id'] if options_list else 'A'
        else:
            prompt_text = sanitize_prompt(pre_ans)
            q_data['question_text'] = prompt_text or f"Question {qnum}"
            if 'yes' in ans_text.lower():
                q_data['question_type'] = 'yes_no'
                q_data['correct_answer'] = 'Yes'
                q_data['answer_options'] = [{'id': 'yes', 'text': 'Yes'}, {'id': 'no', 'text': 'No'}]
            elif 'no' in ans_text.lower():
                q_data['question_type'] = 'yes_no'
                q_data['correct_answer'] = 'No'
                q_data['answer_options'] = [{'id': 'yes', 'text': 'Yes'}, {'id': 'no', 'text': 'No'}]
            else:
                q_data['question_type'] = 'single_choice'
                q_data['correct_answer'] = 'A'
                q_data['answer_options'] = [{'id': 'A', 'text': 'Option A'}, {'id': 'B', 'text': 'Option B'}]

        # Apply Authoritative Patch if present
        patch = AB100_PATCHES.get(str(qnum)) or AB100_PATCHES.get(qnum)
        if patch:
            q_data['question_type'] = patch['question_type']
            if 'question_text' in patch:
                q_data['question_text'] = patch['question_text']
            if 'answer_options' in patch:
                q_data['answer_options'] = patch['answer_options']
            if 'correct_answer' in patch:
                q_data['correct_answer'] = patch['correct_answer']
            if 'question_description' in patch:
                q_data['question_description'] = patch['question_description']
            q_data['partial_credit'] = True

        q_data['question_text'] = sanitize_prompt(q_data['question_text'])

        questions.append(q_data)

    type_counts = {}
    for q in questions:
        t = q['question_type']
        type_counts[t] = type_counts.get(t, 0) + 1

    return {
        'exam_info': exam_info,
        'total_questions': len(questions),
        'summary': type_counts,
        'questions': questions
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: parse_exam_pdf.py <pdf_path> [output_json_path] [output_img_dir]'}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    out_json = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].endswith('.json') else None
    out_dir = sys.argv[3] if len(sys.argv) > 3 else (sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].endswith('.json') else None)
    
    try:
        res = parse_pdf(pdf_path, out_dir)
        if out_json:
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(res, f, indent=2, ensure_ascii=False)
            print(json.dumps({'success': True, 'file': out_json, 'total_questions': res['total_questions'], 'summary': res['summary'], 'exam_info': res['exam_info']}))
        else:
            print(json.dumps(res, indent=2, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

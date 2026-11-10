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
    if c_match: exam_info['code'] = c_match.group(1).strip()
    
    t_match = re.search(r'Exam Name:\s*([^\n]+)', header_text)
    if t_match: exam_info['title'] = t_match.group(1).strip()

    # 2. Extract full clean text with page markers
    full_text = ''
    page_offsets = []
    for p in range(len(doc)):
        p_text = clean_text(doc[p].get_text('text'))
        start_char = len(full_text)
        full_text += f'\n<<<PAGE_{p+1}>>>\n' + p_text + '\n'
        end_char = len(full_text)
        page_offsets.append({'page': p + 1, 'start': start_char, 'end': end_char})

    # 3. Split by QUESTION \d+
    q_matches = list(re.finditer(r'QUESTION\s+(\d+)', full_text))
    questions = []
    
    # Store images dir if output_dir provided
    img_dir = None
    if output_dir:
        img_dir = os.path.join(output_dir, 'uploads', 'questions')
        os.makedirs(img_dir, exist_ok=True)

    current_case_study = {
        'title': '',
        'background': ''
    }

    for i in range(len(q_matches)):
        start = q_matches[i].start()
        end = q_matches[i+1].start() if i + 1 < len(q_matches) else len(full_text)
        block = full_text[start:end].strip()
        qnum = int(q_matches[i].group(1))

        # Check for Case Study header
        cs_match = re.search(r'Case Study\s+(\d+)\s*-\s*([^\n]+)', block, re.IGNORECASE)
        if cs_match:
            current_case_study['title'] = f"Case Study {cs_match.group(1)}: {cs_match.group(2).strip()}"

        # Clean page tags out of block
        clean_block = re.sub(r'<<<PAGE_\d+>>>\n?', '', block)

        # Detect question type
        is_hotspot = bool(re.search(r'Hotspot Question', clean_block[:200], re.IGNORECASE))
        is_dragdrop = bool(re.search(r'Drag and Drop Question', clean_block[:200], re.IGNORECASE))
        is_case_study = bool(cs_match) or ('case study' in clean_block[:200].lower())

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

        # Determine question type & extract details
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

        # Handle Case Study description
        if is_case_study:
            q_data['question_type'] = 'case_study'
            # Look for Background, Problem Statements, Planned Initiatives, Requirements
            bg_match = re.search(r'(Background[\s\S]*?)(?=\n(?:Which|What|How|You need|Select|Hotspot|Drag and Drop|Case Study|\n[A-F]\.))', clean_block)
            if bg_match:
                q_data['question_description'] = f"**{current_case_study.get('title', 'Case Study')}**\n\n" + bg_match.group(1).strip()
            elif current_case_study.get('title'):
                q_data['question_description'] = f"**{current_case_study['title']}**"

        # Now extract the actual question prompt
        # The prompt is between the scenario/type and the options or 'Answer:'
        pre_ans = clean_block[:ans_match.start()] if ans_match else clean_block
        
        # Check for options A. B. C. D...
        opt_matches = list(re.finditer(r'\n([A-F])\.\s+([^\n]+(?:\n(?![A-F]\.|\nAnswer:)[\t ]+[^\n]+)*)', pre_ans))

        if is_hotspot or ('select the appropriate options in the answer area' in pre_ans.lower()):
            q_data['question_type'] = 'hotspot'
            # Extract prompt before NOTE: or Answer:
            prompt_match = re.search(r'(?:Hotspot Question\s*)?([\s\S]*?)(?=\s*To answer|\s*NOTE:|\s*Answer:)', pre_ans)
            prompt = prompt_match.group(1).strip() if prompt_match else pre_ans.strip()
            # Remove Case study background from prompt if already in description
            if q_data['question_description']:
                prompt = re.sub(r'^Case Study[\s\S]*?(?=(?:You need|Which|What|A company|Fabrikam|An organization))', '', prompt, flags=re.IGNORECASE).strip()
            q_data['question_text'] = prompt or f"Question {qnum}"

            # Extract Boxes from explanation
            boxes = re.findall(r'Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?', explanation)
            statements = []
            correct_keys = {}
            if boxes:
                for b_idx, b in enumerate(boxes):
                    box_num = b[0]
                    correct_val = b[1].strip()
                    desc = b[2].strip() if len(b) > 2 and b[2] else f"Requirement / Area {box_num}"
                    stmt_id = f"stmt_{box_num}"
                    statements.append({
                        'id': stmt_id,
                        'statement': f"{desc}: {correct_val}" if 'statement' in desc.lower() else desc,
                        'options': ['Yes', 'No'] if correct_val.lower() in ['yes', 'no'] else [correct_val, 'Other option']
                    })
                    correct_keys[stmt_id] = correct_val if correct_val in ['Yes', 'No'] else correct_val
            
            if not statements:
                # Fallback hotspot statement
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
            q_data['question_text'] = prompt or f"Question {qnum}"

            boxes = re.findall(r'Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?', explanation)
            sources = []
            targets = []
            correct_map = {}
            if boxes:
                for b_idx, b in enumerate(boxes):
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
            # Single Choice or Multiple Response
            # Prompt is text before first option
            prompt_text = pre_ans[:opt_matches[0].start()].strip()
            # Clean off QUESTION X, Case study header etc.
            prompt_text = re.sub(r'^QUESTION\s+\d+\s*', '', prompt_text)
            if is_case_study and q_data['question_description']:
                # The question prompt is usually the last sentence or paragraph
                # e.g. "Which tool should you recommend..."
                q_last_match = re.search(r'\n([A-Z][^\n\?\.]*\?)\s*$', prompt_text)
                if q_last_match:
                    prompt_text = q_last_match.group(1).strip()
                else:
                    lines = [ln.strip() for ln in prompt_text.splitlines() if ln.strip()]
                    prompt_text = lines[-1] if lines else prompt_text

            q_data['question_text'] = prompt_text or f"Question {qnum}"

            options_list = []
            for om in opt_matches:
                letter = om.group(1).strip()
                otext = re.sub(r'\s+', ' ', om.group(2)).strip()
                options_list.append({'id': letter, 'text': otext})
            q_data['answer_options'] = options_list

            # Check answer letters
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
            # Yes/No or simple scenario
            prompt_text = re.sub(r'^QUESTION\s+\d+\s*', '', pre_ans).strip()
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

        questions.append(q_data)

    # 4. Compute Summary
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

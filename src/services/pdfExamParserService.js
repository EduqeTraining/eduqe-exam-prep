const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/**
 * Service to parse Exam PDF dump files (e.g. PassLeader, Microsoft, AWS exam dumps)
 * into structured Eduqe question bank items.
 */
function parseExamPdf(fileDataBase64, fileName = 'exam.pdf') {
  return new Promise((resolve, reject) => {
    if (!fileDataBase64) {
      return reject(new Error('No PDF file data provided.'));
    }

    // Clean up base64 prefix if passed as data URL
    let cleanBase64 = fileDataBase64;
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0) {
      return reject(new Error('Uploaded PDF file is empty.'));
    }

    const tempDir = os.tmpdir();
    const tempPdfName = `eduqe_exam_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
    const tempJsonName = `eduqe_exam_${Date.now()}_${Math.random().toString(36).substring(7)}.json`;
    const tempPdfPath = path.join(tempDir, tempPdfName);
    const tempJsonPath = path.join(tempDir, tempJsonName);

    // Save temporary PDF
    fs.writeFileSync(tempPdfPath, buffer);

    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'parse_exam_pdf.py');

    // Run Python parser
    const py = spawn('python', [scriptPath, tempPdfPath, tempJsonPath]);
    let stderr = '';

    py.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    py.on('close', code => {
      // Clean up temp PDF
      try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (_) {}

      if (code !== 0) {
        try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (_) {}
        return reject(new Error(`Failed to parse PDF (exit code ${code}): ${stderr || 'Unknown parser error'}`));
      }

      if (!fs.existsSync(tempJsonPath)) {
        return reject(new Error('Parser did not generate output JSON file. ' + stderr));
      }

      try {
        const rawJson = fs.readFileSync(tempJsonPath, 'utf8');
        fs.unlinkSync(tempJsonPath);
        const parsed = JSON.parse(rawJson);
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }
        resolve(parsed);
      } catch (err) {
        try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (_) {}
        reject(new Error(`Failed to read parser output: ${err.message}`));
      }
    });

    py.on('error', err => {
      try { if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath); } catch (_) {}
      try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (_) {}
      reject(new Error(`Could not launch Python for PDF parsing: ${err.message}. Please ensure Python is installed.`));
    });
  });
}

module.exports = {
  parseExamPdf
};

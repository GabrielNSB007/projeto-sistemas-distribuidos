import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';

export default function convertTxtToPdf(file: Buffer, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const document = new PDFDocument();
        const output = createWriteStream(outputPath);

        output.on('finish', resolve);
        output.on('error', reject);
        document.on('error', reject);

        document.pipe(output);
        const text = file.toString('utf-8').replace(/\r\n?/g, '\n');
        document.fontSize(12).text(text, { align: 'left' });
        document.end();
    });
}

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
        document.fontSize(12).text(file.toString('utf-8'), { align: 'left' });
        document.end();
    });
}

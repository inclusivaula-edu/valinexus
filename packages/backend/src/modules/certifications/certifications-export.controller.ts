import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { certificationsService } from './certifications.service';
import { UserRole } from '@valinexus/shared';
import { db } from '../../database/connection';

export const certificationsExportController = {
  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      const companyId = user.role === UserRole.SUPER_ADMIN
        ? (req.query.companyId as string) ?? user.companyId
        : user.companyId;

      const certs = await certificationsService.listByCompany(companyId);

      const companyResult = await db.query(
        'SELECT razao_social, cnpj FROM companies WHERE id = $1',
        [companyId]
      );
      const company = companyResult.rows[0];
      const companyName = company?.razao_social ?? 'Empresa';
      const companyCnpj = company?.cnpj ?? '';

      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-compliance-${Date.now()}.pdf"`);
      doc.pipe(res);

      // Header
      doc.fontSize(20).font('Helvetica-Bold').text('VALINEXUS', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text('Relatório de Compliance', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor('#666666')
        .text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, { align: 'center' });
      doc.moveDown(1.5);

      // Company info
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text(companyName);
      if (companyCnpj) doc.fontSize(9).font('Helvetica').fillColor('#444444').text(`CNPJ: ${companyCnpj}`);
      doc.moveDown(1);

      // Summary
      const valid = certs.filter(c => c.status === 'VALID').length;
      const expiring = certs.filter(c => c.status === 'EXPIRING_SOON').length;
      const expired = certs.filter(c => c.status === 'EXPIRED').length;
      const pending = certs.filter(c => c.status === 'PENDING_UPLOAD').length;
      const score = certs.length > 0 ? Math.round((valid / certs.length) * 100) : 0;

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Resumo de Compliance');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text(`Score de Compliance: ${score}%`);
      doc.text(`Total de Certidões: ${certs.length}`);
      doc.text(`Válidas: ${valid} | Vencendo: ${expiring} | Vencidas: ${expired} | Pendentes: ${pending}`);
      doc.moveDown(1.5);

      // Table header
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000').text('Certidões');
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1 = 50, col2 = 220, col3 = 320, col4 = 420;

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444');
      doc.text('CERTIDÃO', col1, tableTop);
      doc.text('CATEGORIA', col2, tableTop);
      doc.text('VENCIMENTO', col3, tableTop);
      doc.text('STATUS', col4, tableTop);

      doc.moveTo(col1, tableTop + 12).lineTo(545, tableTop + 12).strokeColor('#cccccc').stroke();

      let y = tableTop + 18;

      for (const cert of certs) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }

        const statusLabel: Record<string, string> = {
          VALID: 'Válida', EXPIRING_SOON: 'Vencendo', EXPIRED: 'Vencida',
          PENDING_UPLOAD: 'Pendente', UNDER_REVIEW: 'Em Análise',
        };

        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        doc.text(cert.name.substring(0, 30), col1, y, { width: 165 });
        doc.text(cert.category, col2, y, { width: 95 });
        doc.text(cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString('pt-BR') : '-', col3, y, { width: 95 });

        const statusColor = cert.status === 'VALID' ? '#059669'
          : cert.status === 'EXPIRING_SOON' ? '#d97706'
          : cert.status === 'EXPIRED' ? '#dc2626' : '#6b7280';
        doc.fillColor(statusColor).text(statusLabel[cert.status] ?? cert.status, col4, y, { width: 80 });

        y += 16;
      }

      doc.moveDown(2);
      doc.fontSize(7).fillColor('#999999').text(
        'Este relatório é gerado automaticamente pelo sistema VALINEXUS. Para informações atualizadas, consulte o painel online.',
        50, doc.y, { align: 'center', width: 495 }
      );

      doc.end();
    } catch (err) {
      next(err);
    }
  },
};

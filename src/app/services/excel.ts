import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface DiverReport {
  fecha: string;
  cliente: string;
  rfc: string;
  concepto: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  uuid: string;
}

export interface DashboardStats {
  totalFacturas: number;
  totalMonto: number;
  totalIVA: number;
  promedioFactura: number;
  facturasPagadas: number;
  facturasPendientes: number;
  facturasCanceladas: number;
  porCliente: { [key: string]: number };
  porMes: { [key: string]: number };
  porEstado: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  
  private data: DiverReport[] = [];

  readExcelFile(file: File): Promise<DiverReport[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          
          // Try to find "Reporte Diverza" sheet, or use first sheet
          let sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('reporte') || name.toLowerCase().includes('diverza')
          ) || workbook.SheetNames[0];
          
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Parse the data
          this.data = this.parseData(jsonData);
          resolve(this.data);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }

  private parseData(rawData: any[]): DiverReport[] {
    if (rawData.length < 2) return [];
    
    const headers = rawData[0].map((h: string) => h?.toString().toLowerCase().trim() || '');
    const reports: DiverReport[] = [];
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;
      
      const report: DiverReport = {
        fecha: this.getValue(row, headers, ['fecha', 'date']) || '',
        cliente: this.getValue(row, headers, ['cliente', 'nombre', 'razon social', 'customer']) || '',
        rfc: this.getValue(row, headers, ['rfc']) || '',
        concepto: this.getValue(row, headers, ['concepto', 'descripcion', 'description']) || '',
        subtotal: this.getNumericValue(row, headers, ['subtotal', 'sub total']),
        iva: this.getNumericValue(row, headers, ['iva', 'impuesto']),
        total: this.getNumericValue(row, headers, ['total', 'monto', 'importe']),
        estado: this.getValue(row, headers, ['estado', 'status', 'estatus']) || 'Pendiente',
        uuid: this.getValue(row, headers, ['uuid', 'folio fiscal']) || ''
      };
      
      if (report.cliente || report.total > 0) {
        reports.push(report);
      }
    }
    
    return reports;
  }

  private getValue(row: any[], headers: string[], possibleNames: string[]): string {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index !== -1 && row[index] !== undefined) {
        return row[index]?.toString() || '';
      }
    }
    return '';
  }

  private getNumericValue(row: any[], headers: string[], possibleNames: string[]): number {
    const value = this.getValue(row, headers, possibleNames);
    const num = parseFloat(value.replace(/[,$]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  getData(): DiverReport[] {
    return this.data;
  }

  calculateStats(): DashboardStats {
    const stats: DashboardStats = {
      totalFacturas: this.data.length,
      totalMonto: 0,
      totalIVA: 0,
      promedioFactura: 0,
      facturasPagadas: 0,
      facturasPendientes: 0,
      facturasCanceladas: 0,
      porCliente: {},
      porMes: {},
      porEstado: {}
    };

    this.data.forEach(item => {
      stats.totalMonto += item.total;
      stats.totalIVA += item.iva;
      
      // Por estado
      const estado = item.estado.toLowerCase();
      if (estado.includes('pagad') || estado.includes('paid')) {
        stats.facturasPagadas++;
      } else if (estado.includes('cancel')) {
        stats.facturasCanceladas++;
      } else {
        stats.facturasPendientes++;
      }
      
      // Por cliente
      if (item.cliente) {
        stats.porCliente[item.cliente] = (stats.porCliente[item.cliente] || 0) + item.total;
      }
      
      // Por mes
      if (item.fecha) {
        const mes = this.extractMonth(item.fecha);
        stats.porMes[mes] = (stats.porMes[mes] || 0) + item.total;
      }
      
      // Por estado (para gráfico)
      stats.porEstado[item.estado] = (stats.porEstado[item.estado] || 0) + 1;
    });

    stats.promedioFactura = stats.totalFacturas > 0 ? stats.totalMonto / stats.totalFacturas : 0;
    
    return stats;
  }

  private extractMonth(fecha: string): string {
    try {
      const date = new Date(fecha);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
      }
    } catch {}
    return fecha.substring(0, 7) || 'Sin fecha';
  }
}

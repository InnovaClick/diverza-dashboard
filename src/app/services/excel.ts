import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface DiverReport {
  // Campos de facturación
  fecha: string;
  cliente: string;
  rfc: string;
  concepto: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  uuid: string;
  // Campos de cliente (versión estable)
  id: string;
  razonSocial: string;
  gerencia: string;
  regimen: string;
  csd: string;
  expCsd: string;
  fechaFirma: string;
  email: string;
}

export interface DashboardStats {
  // Stats de facturas (legacy)
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
  // Stats de clientes (versión estable)
  totalRegistros: number;
  csdActivos: number;
  csdInactivos: number;
  pendientesFirma: number;
  porGerencia: { [key: string]: number };
  porRegimen: { [key: string]: number };
  porMesFirma: { [key: string]: number };
  porExpiracion: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  
  private data: DiverReport[] = [];
  private readonly STORAGE_KEY = 'diverzaData';

  constructor() {
    // Cargar datos guardados al iniciar
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.data = JSON.parse(stored);
        console.log(`Datos recuperados de localStorage: ${this.data.length} registros`);
      }
    } catch (e) {
      console.error('Error cargando datos de localStorage:', e);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      console.log(`Datos guardados en localStorage: ${this.data.length} registros`);
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }

  readExcelFile(file: File): Promise<DiverReport[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          
          // Try to find "Reporte Diverza" sheet (exact match like stable version)
          let sheetName = workbook.SheetNames.find(name => 
            name.toLowerCase().includes('reporte diverza') || 
            name.toLowerCase().includes('reportediverza')
          );
          
          // If not found, use first sheet
          if (!sheetName) {
            sheetName = workbook.SheetNames[0];
            console.log('Hoja "Reporte Diverza" no encontrada, usando:', sheetName);
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Parse the data
          this.data = this.parseData(jsonData);
          // Guardar en localStorage para persistencia
          this.saveToStorage();
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
      
      // Obtener CSD y determinar si está activo
      const csdRaw = this.getValue(row, headers, ['csd activo', 'csdactivo', 'csd']);
      const csdActivo = csdRaw?.toUpperCase() === 'SI' ? 'Activo' : (csdRaw ? 'Inactivo' : '');

      const report: DiverReport = {
        // Campos de facturación (legacy)
        fecha: this.getValue(row, headers, ['fecha', 'date']) || '',
        cliente: this.getValue(row, headers, ['idcliente', 'id', 'cliente']) || String(i),
        rfc: this.getValue(row, headers, ['rfc']) || '',
        concepto: this.getValue(row, headers, ['concepto', 'descripcion']) || '',
        subtotal: this.getNumericValue(row, headers, ['subtotal']),
        iva: this.getNumericValue(row, headers, ['iva', 'impuesto']),
        total: this.getNumericValue(row, headers, ['total', 'monto']),
        estado: this.getValue(row, headers, ['estado', 'status']) || '',
        uuid: this.getValue(row, headers, ['uuid', 'folio fiscal']) || '',
        // Campos de cliente (versión estable - EXACTOS)
        id: this.getValue(row, headers, ['idcliente', 'id']) || String(i),
        razonSocial: this.getValue(row, headers, ['razonsocial', 'razon social', 'razón social', 'nombre']) || '',
        gerencia: this.getValue(row, headers, ['gerencia']) || 'N/A',
        regimen: this.getValue(row, headers, ['regimen fiscal', 'regimenfiscal', 'régimen fiscal']) || 'N/A',
        csd: csdActivo,
        expCsd: this.parseDate(this.getValue(row, headers, ['expiration_date', 'expirationdate', 'exp csd', 'exp. csd'])),
        fechaFirma: this.parseDate(this.getValue(row, headers, ['fechafirmadocliente', 'fechafirmadocliente', 'fecha firma'])),
        email: this.getValue(row, headers, ['email', 'correo']) || ''
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
      // Stats de facturas (legacy)
      totalFacturas: this.data.length,
      totalMonto: 0,
      totalIVA: 0,
      promedioFactura: 0,
      facturasPagadas: 0,
      facturasPendientes: 0,
      facturasCanceladas: 0,
      porCliente: {},
      porMes: {},
      porEstado: {},
      // Stats de clientes (versión estable)
      totalRegistros: this.data.length,
      csdActivos: 0,
      csdInactivos: 0,
      pendientesFirma: 0,
      porGerencia: {},
      porRegimen: {},
      porMesFirma: {},
      porExpiracion: {}
    };

    const hoy = new Date();

    this.data.forEach(item => {
      stats.totalMonto += item.total;
      stats.totalIVA += item.iva;
      
      // Por estado (facturas)
      const estado = item.estado?.toLowerCase() || '';
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
      if (item.estado) {
        stats.porEstado[item.estado] = (stats.porEstado[item.estado] || 0) + 1;
      }

      // === Stats de clientes (versión estable) ===
      
      // CSD Activos/Inactivos (igual que versión estable)
      if (item.csd === 'Activo') {
        stats.csdActivos++;
      } else if (item.csd === 'Inactivo') {
        stats.csdInactivos++;
      }

      // Pendientes de firma
      if (!item.fechaFirma || item.fechaFirma.trim() === '') {
        stats.pendientesFirma++;
      }

      // Por gerencia
      if (item.gerencia) {
        const gerencia = item.gerencia.includes('Matriz') ? item.gerencia : item.gerencia.split(',')[0].trim();
        stats.porGerencia[gerencia] = (stats.porGerencia[gerencia] || 0) + 1;
      }

      // Por régimen
      if (item.regimen) {
        let regimenCorto = 'Otro';
        const reg = item.regimen.toLowerCase();
        if (reg.includes('pfae') || reg.includes('actividades empresariales')) {
          regimenCorto = 'PFAE';
        } else if (reg.includes('resico') || reg.includes('simplificado')) {
          regimenCorto = 'RESICO';
        } else if (reg.includes('moral')) {
          regimenCorto = 'PM';
        }
        stats.porRegimen[regimenCorto] = (stats.porRegimen[regimenCorto] || 0) + 1;
      }

      // Por mes de firma
      if (item.fechaFirma) {
        const mesFirma = this.extractMonth(item.fechaFirma);
        stats.porMesFirma[mesFirma] = (stats.porMesFirma[mesFirma] || 0) + 1;
      }

      // Por expiración de CSD
      if (item.expCsd) {
        try {
          const exp = new Date(item.expCsd);
          const meses = (exp.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24 * 30);
          let categoria = '> 2 años';
          if (meses < 6) categoria = '< 6 meses';
          else if (meses < 12) categoria = '6-12 meses';
          else if (meses < 24) categoria = '1-2 años';
          stats.porExpiracion[categoria] = (stats.porExpiracion[categoria] || 0) + 1;
        } catch {}
      }
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

  private parseDate(val: any): string {
    if (!val) return '';
    // Handle Excel date serial numbers
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    // Handle string dates
    if (typeof val === 'string') {
      const match = val.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) return match[0];
      // Try other formats
      const date = new Date(val);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
      return val;
    }
    return '';
  }
}

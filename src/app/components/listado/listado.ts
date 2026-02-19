import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ExcelService, DiverReport } from '../../services/excel';

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './listado.html',
  styleUrl: './listado.scss'
})
export class Listado implements OnInit {
  data: DiverReport[] = [];
  filteredData: DiverReport[] = [];
  searchTerm = '';
  filterCsd = '';
  filterRegimen = '';
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  regimenes: string[] = [];
  filterLabel = '';

  constructor(private excelService: ExcelService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.data = this.excelService.getData();
    this.filteredData = [...this.data];
    this.regimenes = [...new Set(this.data.map(d => d.regimen).filter(r => r))];
    
    // Procesar query params para filtros desde dashboard
    this.route.queryParams.subscribe(params => {
      this.applyUrlFilters(params);
    });
  }

  applyUrlFilters(params: any) {
    const filtro = params['filtro'];
    const tipo = params['tipo'];
    const valor = params['valor'];

    if (filtro) {
      switch (filtro) {
        case 'todos':
          this.filterLabel = 'Todos los registros';
          this.filteredData = [...this.data];
          break;
        case 'activos':
          this.filterLabel = 'CSD Activos';
          this.filteredData = this.data.filter(d => d.csd === 'Activo');
          break;
        case 'inactivos':
          this.filterLabel = 'CSD Inactivos';
          this.filteredData = this.data.filter(d => d.csd === 'Inactivo');
          break;
        case 'pendientes':
          this.filterLabel = 'Pendientes de Firma';
          this.filteredData = this.data.filter(d => !d.fechaFirma || d.fechaFirma.trim() === '');
          break;
      }
    } else if (tipo && valor) {
      switch (tipo) {
        case 'mes':
          this.filterLabel = `Firmas en ${valor}`;
          this.filteredData = this.data.filter(d => d.fechaFirma && d.fechaFirma.includes(valor.substring(0, 7)));
          break;
        case 'gerencia':
          this.filterLabel = `Gerencia: ${valor}`;
          this.filteredData = this.data.filter(d => {
            const g = d.gerencia?.includes('Matriz') ? d.gerencia : d.gerencia?.split(',')[0];
            return g === valor;
          });
          break;
        case 'regimen':
          this.filterLabel = `Régimen: ${valor}`;
          this.filteredData = this.data.filter(d => {
            const reg = d.regimen?.toLowerCase() || '';
            if (valor === 'PFAE') return reg.includes('pfae') || reg.includes('actividades empresariales');
            if (valor === 'RESICO') return reg.includes('resico') || reg.includes('simplificado');
            if (valor === 'PM') return reg.includes('moral');
            return d.regimen === valor;
          });
          break;
        case 'expiracion':
          this.filterLabel = `Expiración CSD: ${valor}`;
          const hoy = new Date();
          this.filteredData = this.data.filter(d => {
            if (!d.expCsd) return false;
            const exp = new Date(d.expCsd);
            const meses = (exp.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (valor === '< 6 meses') return meses < 6;
            if (valor === '6-12 meses') return meses >= 6 && meses < 12;
            if (valor === '1-2 años') return meses >= 12 && meses < 24;
            if (valor === '> 2 años') return meses >= 24;
            return false;
          });
          break;
      }
    } else {
      this.filterLabel = '';
      this.filteredData = [...this.data];
    }
  }

  applyFilters() {
    this.filteredData = this.data.filter(item => {
      const matchesSearch = !this.searchTerm || 
        (item.razonSocial?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (item.rfc?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (item.gerencia?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (item.email?.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (item.id?.toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      const matchesCsd = !this.filterCsd || 
        (this.filterCsd === 'Activo' && item.csd?.toLowerCase().includes('activo')) ||
        (this.filterCsd === 'Inactivo' && !item.csd?.toLowerCase().includes('activo'));
      
      const matchesRegimen = !this.filterRegimen || item.regimen === this.filterRegimen;
      
      return matchesSearch && matchesCsd && matchesRegimen;
    });
    
    if (this.sortColumn) {
      this.sortData(this.sortColumn, false);
    }
  }

  sortData(column: string, toggleDirection = true) {
    if (toggleDirection) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    }
    
    this.filteredData.sort((a: any, b: any) => {
      let valueA = a[column];
      let valueB = b[column];
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return this.sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      valueA = valueA?.toString().toLowerCase() || '';
      valueB = valueB?.toString().toLowerCase() || '';
      
      if (this.sortDirection === 'asc') {
        return valueA.localeCompare(valueB);
      } else {
        return valueB.localeCompare(valueA);
      }
    });
  }

  getCsdClass(csd: string): string {
    if (!csd) return 'status-unknown';
    const lower = csd.toLowerCase();
    if (lower.includes('activo') || lower === 'si') return 'status-active';
    if (lower.includes('inactivo') || lower === 'no') return 'status-inactive';
    return 'status-unknown';
  }

  getRegimenClass(regimen: string): string {
    if (!regimen) return '';
    const lower = regimen.toLowerCase();
    if (lower.includes('pfae') || lower.includes('actividades empresariales')) return 'regimen-pfae';
    if (lower.includes('resico') || lower.includes('simplificado')) return 'regimen-resico';
    if (lower.includes('moral') || lower.includes('pm')) return 'regimen-pm';
    return 'regimen-otro';
  }

  getRegimenShort(regimen: string): string {
    if (!regimen) return '—';
    const lower = regimen.toLowerCase();
    if (lower.includes('pfae') || lower.includes('actividades empresariales')) return 'PFAE';
    if (lower.includes('resico') || lower.includes('simplificado')) return 'RESICO';
    if (lower.includes('moral')) return 'PM';
    if (regimen.length > 20) return regimen.substring(0, 20) + '...';
    return regimen;
  }

  exportToCSV() {
    const headers = ['ID', 'Razón Social', 'RFC', 'Gerencia', 'Régimen', 'CSD', 'Exp. CSD', 'Fecha Firma', 'Email'];
    const rows = this.filteredData.map(item => [
      item.id,
      item.razonSocial,
      item.rfc,
      item.gerencia,
      item.regimen,
      item.csd,
      item.expCsd,
      item.fechaFirma,
      item.email
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell || ''}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'listado_clientes_diverza.csv';
    link.click();
  }
}

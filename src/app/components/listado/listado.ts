import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  constructor(private excelService: ExcelService) {}

  ngOnInit() {
    this.data = this.excelService.getData();
    this.filteredData = [...this.data];
    this.regimenes = [...new Set(this.data.map(d => d.regimen).filter(r => r))];
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

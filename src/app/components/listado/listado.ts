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
  filterEstado = '';
  sortColumn = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  estados: string[] = [];

  constructor(private excelService: ExcelService) {}

  ngOnInit() {
    this.data = this.excelService.getData();
    this.filteredData = [...this.data];
    this.estados = [...new Set(this.data.map(d => d.estado))].filter(e => e);
  }

  applyFilters() {
    this.filteredData = this.data.filter(item => {
      const matchesSearch = !this.searchTerm || 
        item.cliente.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.rfc.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.concepto.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.uuid.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesEstado = !this.filterEstado || item.estado === this.filterEstado;
      
      return matchesSearch && matchesEstado;
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

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  }

  getEstadoClass(estado: string): string {
    const lower = estado.toLowerCase();
    if (lower.includes('pagad') || lower.includes('paid')) return 'status-paid';
    if (lower.includes('cancel')) return 'status-cancelled';
    return 'status-pending';
  }

  exportToCSV() {
    const headers = ['Fecha', 'Cliente', 'RFC', 'Concepto', 'Subtotal', 'IVA', 'Total', 'Estado', 'UUID'];
    const rows = this.filteredData.map(item => [
      item.fecha,
      item.cliente,
      item.rfc,
      item.concepto,
      item.subtotal,
      item.iva,
      item.total,
      item.estado,
      item.uuid
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reporte_diverza.csv';
    link.click();
  }
}

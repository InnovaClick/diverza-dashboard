import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { ExcelService, DashboardStats } from '../../services/excel';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  isDragOver = false;
  isLoading = false;
  hasData = false;
  errorMessage = '';
  fileName = '';
  
  stats: DashboardStats | null = null;

  // Chart configurations
  barChartType: ChartType = 'bar';
  pieChartType: ChartType = 'pie';
  
  clienteChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Monto por Cliente', backgroundColor: [] }]
  };
  
  estadoChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#4CAF50', '#FF9800', '#f44336'] }]
  };
  
  mesChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Monto por Mes', backgroundColor: '#00d4ff' }]
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#fff' } }
    },
    scales: {
      x: { ticks: { color: '#8892b0' }, grid: { color: 'rgba(255,255,255,0.1)' } },
      y: { ticks: { color: '#8892b0' }, grid: { color: 'rgba(255,255,255,0.1)' } }
    }
  };

  pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#fff' } }
    }
  };

  constructor(private excelService: ExcelService) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  async processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      this.errorMessage = 'Por favor selecciona un archivo Excel (.xlsx o .xls)';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.fileName = file.name;

    try {
      await this.excelService.readExcelFile(file);
      this.stats = this.excelService.calculateStats();
      this.updateCharts();
      this.hasData = true;
    } catch (error) {
      this.errorMessage = 'Error al procesar el archivo. Verifica el formato.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  updateCharts() {
    if (!this.stats) return;

    // Top 5 clientes
    const clienteEntries = Object.entries(this.stats.porCliente)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    this.clienteChartData = {
      labels: clienteEntries.map(e => e[0].substring(0, 20)),
      datasets: [{
        data: clienteEntries.map(e => e[1]),
        label: 'Monto',
        backgroundColor: ['#00d4ff', '#7b2cbf', '#ff6b6b', '#feca57', '#54a0ff']
      }]
    };

    // Estados
    this.estadoChartData = {
      labels: ['Pagadas', 'Pendientes', 'Canceladas'],
      datasets: [{
        data: [
          this.stats.facturasPagadas,
          this.stats.facturasPendientes,
          this.stats.facturasCanceladas
        ],
        backgroundColor: ['#4CAF50', '#FF9800', '#f44336']
      }]
    };

    // Por mes
    const mesEntries = Object.entries(this.stats.porMes);
    this.mesChartData = {
      labels: mesEntries.map(e => e[0]),
      datasets: [{
        data: mesEntries.map(e => e[1]),
        label: 'Monto',
        backgroundColor: '#00d4ff'
      }]
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  }
}

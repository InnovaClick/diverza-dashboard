import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
  lastUpdate = '-';
  
  stats: DashboardStats | null = null;

  // Chart configurations
  barChartType: ChartType = 'bar';
  pieChartType: ChartType = 'pie';
  
  mesFirmaChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Registros', backgroundColor: '#00d4ff' }]
  };
  
  gerenciaChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#00d4ff', '#7b2cbf', '#ff6b6b', '#feca57', '#54a0ff', '#00ff88'] }]
  };
  
  regimenChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], backgroundColor: ['#00d4ff', '#7b2cbf', '#feca57', '#666'] }]
  };

  expiracionChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Registros', backgroundColor: [] }]
  };

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
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
      legend: { position: 'right', labels: { color: '#fff', padding: 15 } }
    }
  };

  constructor(private excelService: ExcelService, private router: Router) {
    // Cargar datos existentes al iniciar
    const existingData = this.excelService.getData();
    if (existingData.length > 0) {
      this.hasData = true;
      this.stats = this.excelService.calculateStats();
      this.updateCharts();
      this.fileName = 'Archivo anterior';
      this.lastUpdate = 'Datos recuperados de sesión anterior';
    }
  }

  // Handlers para clicks en gráficas
  onMesFirmaClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const keys = Object.keys(this.stats?.porMesFirma || {}).sort();
      const mes = keys[index];
      if (mes) {
        this.router.navigate(['/listado'], { queryParams: { tipo: 'mes', valor: mes } });
      }
    }
  }

  onGerenciaClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const keys = Object.keys(this.stats?.porGerencia || {}).sort((a, b) => 
        (this.stats?.porGerencia[b] || 0) - (this.stats?.porGerencia[a] || 0)
      );
      const gerencia = keys[index];
      if (gerencia) {
        this.router.navigate(['/listado'], { queryParams: { tipo: 'gerencia', valor: gerencia } });
      }
    }
  }

  onRegimenClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const keys = Object.keys(this.stats?.porRegimen || {});
      const regimen = keys[index];
      if (regimen) {
        this.router.navigate(['/listado'], { queryParams: { tipo: 'regimen', valor: regimen } });
      }
    }
  }

  onExpiracionClick(event: any) {
    if (event.active && event.active.length > 0) {
      const index = event.active[0].index;
      const expOrder = ['< 6 meses', '6-12 meses', '1-2 años', '> 2 años'];
      const expEntries = expOrder.filter(cat => (this.stats?.porExpiracion[cat] || 0) > 0);
      const categoria = expEntries[index];
      if (categoria) {
        this.router.navigate(['/listado'], { queryParams: { tipo: 'expiracion', valor: categoria } });
      }
    }
  }

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
      this.lastUpdate = new Date().toLocaleString('es-MX');
    } catch (error) {
      this.errorMessage = 'Error al procesar el archivo. Verifica el formato.';
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  updateCharts() {
    if (!this.stats) return;

    // Registros por mes de firma
    const mesFirmaEntries = Object.entries(this.stats.porMesFirma).sort((a, b) => a[0].localeCompare(b[0]));
    this.mesFirmaChartData = {
      labels: mesFirmaEntries.map(e => e[0]),
      datasets: [{
        data: mesFirmaEntries.map(e => e[1]),
        label: 'Registros',
        backgroundColor: '#00d4ff'
      }]
    };

    // Por gerencia
    const gerenciaEntries = Object.entries(this.stats.porGerencia).sort((a, b) => b[1] - a[1]);
    this.gerenciaChartData = {
      labels: gerenciaEntries.map(e => e[0]),
      datasets: [{
        data: gerenciaEntries.map(e => e[1]),
        backgroundColor: ['#00d4ff', '#7b2cbf', '#ff6b6b', '#feca57', '#54a0ff', '#00ff88', '#e056fd', '#686de0']
      }]
    };

    // Por régimen
    const regimenEntries = Object.entries(this.stats.porRegimen);
    this.regimenChartData = {
      labels: regimenEntries.map(e => e[0]),
      datasets: [{
        data: regimenEntries.map(e => e[1]),
        backgroundColor: ['#00d4ff', '#7b2cbf', '#feca57', '#666']
      }]
    };

    // Por expiración
    const expOrder = ['< 6 meses', '6-12 meses', '1-2 años', '> 2 años'];
    const expColors = ['#ff6b6b', '#feca57', '#54a0ff', '#00ff88'];
    const expiracionEntries = expOrder
      .map(cat => ({ cat, val: this.stats!.porExpiracion[cat] || 0 }))
      .filter(e => e.val > 0);
    
    this.expiracionChartData = {
      labels: expiracionEntries.map(e => e.cat),
      datasets: [{
        data: expiracionEntries.map(e => e.val),
        label: 'Registros',
        backgroundColor: expiracionEntries.map((e, i) => expColors[expOrder.indexOf(e.cat)])
      }]
    };
  }
}

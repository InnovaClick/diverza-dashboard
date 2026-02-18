import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Listado } from './components/listado/listado';

export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'listado', component: Listado },
  { path: '**', redirectTo: '' }
];

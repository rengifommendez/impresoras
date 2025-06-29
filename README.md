# Sistema de Gestión de Conteos de Impresión

Sistema completo desarrollado con React, TypeScript, Tailwind CSS y Supabase para la gestión y análisis de conteos de impresión empresarial.

## 🚀 Características

### ✨ Funcionalidades Principales
- **Autenticación segura** con Supabase Auth
- **Importación automatizada** de archivos CSV mensuales
- **Dashboard interactivo** con métricas en tiempo real
- **Gestión de usuarios** con roles y permisos
- **Consultas REST y RPC** optimizadas
- **Interfaz responsive** para escritorio y móviles
- **Sistema de auditoría** completo

### 📊 Análisis y Reportes
- Total de impresiones por usuario
- Detalle mensual por tipo (color/mono, copia, escaneo, fax)
- Diferencias y tendencias mensuales
- Estadísticas agregadas del sistema
- Ranking de usuarios más activos

### 🔒 Seguridad
- Row Level Security (RLS) habilitado
- Políticas de acceso basadas en roles
- Validación de datos en backend
- Auditoría de todas las importaciones

## 🛠️ Tecnologías

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Estado**: TanStack Query (React Query)
- **Iconos**: Lucide React
- **Build Tool**: Vite

## 📋 Prerrequisitos

- Node.js 18+ 
- Cuenta de Supabase
- Navegador moderno

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd prints-management-system
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Supabase

1. Crear un nuevo proyecto en [Supabase](https://supabase.com)
2. Ejecutar las migraciones SQL desde `supabase/migrations/`
3. Crear archivo `.env` basado en `.env.example`:

```env
VITE_SUPABASE_URL=tu-supabase-url
VITE_SUPABASE_ANON_KEY=tu-supabase-anon-key
VITE_APP_NAME=Sistema de Gestión de Impresiones
VITE_DEFAULT_TIMEZONE=America/Bogota
```

### 4. Configurar usuarios administradores

Crear usuarios admin en Supabase Auth con metadata:
```json
{
  "role": "admin",
  "full_name": "Nombre Completo"
}
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── Dashboard.tsx   # Dashboard principal
│   ├── Layout.tsx      # Layout de la aplicación
│   ├── LoginForm.tsx   # Formulario de login
│   ├── StatsCard.tsx   # Tarjetas de estadísticas
│   ├── UploadCSV.tsx   # Subida de archivos CSV
│   └── UsersTable.tsx  # Tabla de usuarios
├── hooks/              # Hooks personalizados
│   └── useAuth.ts      # Hook de autenticación
├── lib/                # Librerías y utilidades
│   ├── auth.ts         # Lógica de autenticación
│   └── supabase.ts     # Cliente de Supabase
└── App.tsx             # Componente principal

supabase/
└── migrations/         # Migraciones de base de datos
    └── create_prints_schema.sql
```

## 📊 Modelo de Datos

### Tablas Principales

#### `users`
- Información de usuarios del sistema
- ID de cuenta como clave primaria
- Estado, email, nombre completo, oficina

#### `prints_raw`
- Datos brutos de cada importación CSV
- Todos los campos originales preservados
- Trazabilidad completa por batch

#### `prints_monthly`
- Agregados mensuales optimizados
- Totales por tipo de operación
- Diferencias vs mes anterior
- Índice único (user_id, year, month)

#### `import_log`
- Auditoría de importaciones
- Estadísticas de éxito/fallo
- Detalles de errores

### Funciones RPC Disponibles

```sql
-- Total por usuario
SELECT * FROM total_by_user('0000');

-- Detalle mensual
SELECT * FROM monthly_detail('0000', 2025);

-- Estadísticas del dashboard
SELECT * FROM dashboard_stats();
```

## 📤 Formato CSV de Importación

### Estructura Esperada
```csv
ID de la cuenta;Estado de la cuenta;Imprimir (total);Imprimir (a todo color);...;Marca de tiempo
0000;Normal;168;;;...;24/06/2025 8:43:12 a. m.
0104;Normal;38;;;...;24/06/2025 8:43:12 a. m.
```

### Especificaciones
- **Delimitador**: Punto y coma (;)
- **Codificación**: latin-1 o UTF-8
- **Campos clave**: ID de cuenta (columna 1), Timestamp (última columna)
- **Validación**: Automática con registro de errores

## 🔧 Importación Mensual

### Proceso Automatizado
1. **Validación** de formato y estructura
2. **Upsert** de usuarios nuevos/existentes
3. **Inserción** de datos raw con batch ID
4. **Actualización** de agregados mensuales
5. **Cálculo** de diferencias vs mes anterior
6. **Registro** en log de auditoría

### Manejo de Errores
- Filas inválidas registradas separadamente
- Conversión automática de campos vacíos a 0
- Continuación del proceso ante errores individuales
- Reporte detallado de resultados

## 👥 Roles y Permisos

### Administrador (`admin`)
- Acceso completo al sistema
- Subida e importación de CSV
- Gestión de usuarios
- Visualización de todos los reportes

### Usuario (`user`)
- Visualización de dashboard
- Acceso a reportes generales
- Sin permisos de modificación

## 🚀 Despliegue

### Desarrollo Local
```bash
npm run dev
```

### Producción
```bash
npm run build
npm run preview
```

### Variables de Entorno Producción
- Configurar variables en plataforma de hosting
- Verificar URLs de Supabase
- Configurar políticas RLS apropiadas

## 🔒 Seguridad y Mejores Prácticas

### Implementadas
- ✅ Row Level Security en todas las tablas
- ✅ Validación de roles en funciones
- ✅ Sanitización de inputs
- ✅ Manejo seguro de archivos
- ✅ Logs de auditoría completos

### Recomendaciones
- Backup automático de base de datos
- Monitoreo de performance
- Rotación de claves API
- Revisión periódica de permisos

## 📈 Métricas y Monitoreo

### Dashboard Incluye
- Total de usuarios registrados
- Usuarios activos por mes
- Volumen de impresiones/copias
- Última importación realizada
- Ranking de usuarios más activos

### Consultas Optimizadas
- Índices en campos frecuentemente consultados
- Vistas materializadas para reportes pesados
- Funciones RPC para lógica compleja
- Cache en frontend con React Query

## 🆘 Soporte y Troubleshooting

### Problemas Comunes

**Error de conexión a Supabase**
- Verificar variables de entorno
- Confirmar URLs y claves API
- Revisar configuración de RLS

**Fallos en importación CSV**
- Verificar formato y delimitadores
- Revisar codificación del archivo
- Consultar logs de import_log

**Permisos insuficientes**
- Confirmar rol del usuario
- Revisar políticas RLS
- Verificar configuración de auth

### Logs y Debugging
- Logs detallados en consola de desarrollo
- Tabla import_log para auditoría
- Métricas de performance en Supabase Dashboard

## 📝 Changelog

### v1.0.0
- ✅ Implementación inicial
- ✅ Sistema de autenticación
- ✅ Dashboard básico
- ✅ Importación CSV
- ✅ Gestión de usuarios
- ✅ Funciones RPC
- ✅ Sistema de auditoría

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork del proyecto
2. Crear rama para feature (`git checkout -b feature/AmazingFeature`)
3. Commit de cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

**Desarrollado con ❤️ para optimizar la gestión de recursos de impresión empresarial**
# 🔐 Crear Usuario Administrador - Estiven

## 📋 Datos del Usuario Administrador

- **Nombre**: Estiven
- **Email**: estivenmendezr@gmail.com
- **Contraseña**: admin123
- **Rol**: Administrador

## 🚀 Método 1: Registro desde la Aplicación (Recomendado)

### Paso 1: Registrar Usuario Normal
1. Ve a la página de login de la aplicación
2. Haz clic en **"¿No tiene una cuenta? Crear cuenta"**
3. Completa el formulario:
   - **Nombre Completo**: `Estiven`
   - **Email**: `estivenmendezr@gmail.com`
   - **Contraseña**: `admin123`
4. Haz clic en **"Crear Cuenta"**

### Paso 2: Convertir a Administrador
1. Ve al **Dashboard de Supabase** (https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Authentication > Users**
4. Busca el usuario `estivenmendezr@gmail.com`
5. Haz clic en el usuario para editarlo
6. En la sección **"User Metadata"**, agrega:
   ```json
   {
     "role": "admin",
     "full_name": "Estiven"
   }
   ```
7. Guarda los cambios

## 🛠️ Método 2: SQL Directo (Avanzado)

Si tienes acceso al **SQL Editor** de Supabase:

```sql
-- 1. Crear usuario en auth.users (esto normalmente lo hace Supabase Auth)
-- NOTA: Este paso debe hacerse desde el dashboard de Supabase Auth

-- 2. Después de crear el usuario, actualizar metadata
UPDATE auth.users 
SET raw_user_meta_data = jsonb_build_object(
  'role', 'admin',
  'full_name', 'Estiven'
)
WHERE email = 'estivenmendezr@gmail.com';

-- 3. Crear entrada en la tabla users (opcional, se crea automáticamente en la primera importación)
INSERT INTO public.users (id, status, email, full_name)
VALUES ('admin-user-id', 'Normal', 'estivenmendezr@gmail.com', 'Estiven')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = now();
```

## ✅ Verificar que Funciona

### 1. Iniciar Sesión
- Email: `estivenmendezr@gmail.com`
- Contraseña: `admin123`

### 2. Verificar Permisos de Administrador
Después de iniciar sesión, deberías ver:
- ✅ Pestaña **"Subir CSV"** (solo admins)
- ✅ Pestaña **"Gestión"** (solo admins)
- ✅ Texto **(Admin)** junto al email en el header
- ✅ Acceso completo a todas las funcionalidades

### 3. Funcionalidades de Administrador
Como administrador, Estiven podrá:
- 📤 **Subir archivos CSV** para importar datos
- ⚙️ **Gestionar usuarios** (editar nombres, oficinas, etc.)
- 📊 **Ver todos los reportes** y estadísticas
- 📥 **Exportar datos** a CSV
- 👥 **Administrar el sistema** completo

## 🔒 Seguridad

### Cambiar Contraseña (Recomendado)
1. Inicia sesión con las credenciales temporales
2. Ve a **Configuración de Usuario** (si está disponible)
3. O usa el **Reset Password** de Supabase para cambiar la contraseña

### Metadata del Usuario Administrador
```json
{
  "role": "admin",
  "full_name": "Estiven",
  "office": "Administración",
  "department": "IT"
}
```

## 🚨 Importante

1. **Método Recomendado**: Usar el registro normal + cambio de metadata
2. **Seguridad**: Cambiar la contraseña después del primer login
3. **Verificación**: Confirmar que aparece **(Admin)** en el header
4. **Funcionalidad**: Probar subida de CSV y gestión de usuarios

## 📞 Soporte

Si tienes problemas:
1. Verifica que el email esté correcto en Supabase Auth
2. Confirma que el metadata tenga `"role": "admin"`
3. Revisa que no haya errores en la consola del navegador
4. Intenta cerrar sesión y volver a iniciar

---

**¡Listo!** Estiven ahora tendrá acceso completo como administrador del sistema. 🎉
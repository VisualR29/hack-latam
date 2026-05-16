# 🔑 Configurar GitHub OAuth en Supabase

## Paso 1: Crear OAuth App en GitHub

1. Ve a https://github.com/settings/developers
2. Haz clic en **"New OAuth App"**
3. Completa el formulario:

```
Application name: VibeGuard
Homepage URL: http://localhost:5173 (desarrollo)
                https://tubdominio.com (producción)

Application description: Herramienta de análisis de seguridad

Authorization callback URL: https://[TU_PROYECTO].supabase.co/auth/v1/callback
```

4. Haz clic en **"Register application"**
5. Copiarás dos valores importantes:
   - **Client ID** (visible en la página)
   - **Client secret** (generará uno nuevo, cópialo INMEDIATAMENTE)

---

## Paso 2: Configurar en Supabase

1. Ve a tu proyecto Supabase
2. **Authentication** → **Providers**
3. Busca **GitHub** y haz clic en el toggle para habilitar
4. Pega:
   - **Client ID**: De GitHub
   - **Client Secret**: De GitHub (no compartir)
5. Haz clic en **Save**

---

## Paso 3: Testear en Desarrollo

```typescript
import { signInWithGitHub } from './services/supabase-client'

// En tu botón
async function handleGitHubLogin() {
  try {
    const { data } = await signInWithGitHub()
    console.log('GitHub login initiated:', data)
  } catch (error) {
    console.error('GitHub login error:', error)
  }
}
```

### URLs Locales Válidas para Testing
- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:3000`

**NO FUNCIONAN:**
- `http://0.0.0.0:5173` ❌
- URLs con puertos dinámicos ❌

---

## Paso 4: Configurar para Producción

### En GitHub OAuth App:
1. Ve a tu OAuth App nuevamente
2. **Application settings** → **Authorization callback URLs**
3. Cambia:
   ```
   http://localhost:5173/callback
   ```
   por:
   ```
   https://tubdominio.com/auth/callback
   ```

### En Supabase:
1. Ve a **Project Settings** → **API**
2. Copia el **Project URL**
3. En GitHub, usa:
   ```
   https://[TU_PROYECTO].supabase.co/auth/v1/callback
   ```

---

## Paso 5: Flujo de Login Completo

```typescript
/**
 * Flujo completo de autenticación con GitHub
 */

import { supabase } from './services/supabase-client'

async function handleGitHubLogin() {
  try {
    // 1. Iniciar sesión con GitHub
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) throw error

    // 2. El usuario es redirigido a GitHub
    // 3. GitHub redirige de vuelta a tu app
    // 4. Supabase automáticamente crea la sesión

    // 5. El usuario regresa a tu app (en /callback)
    // Obtener el usuario autenticado:
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user?.email) {
      // 6. Crear/actualizar perfil en tabla users
      await upsertUserProfile(user.id, {
        email: user.email,
        github_username: user.user_metadata?.user_name,
        github_id: user.user_metadata?.provider_id,
        avatar_url: user.user_metadata?.avatar_url,
      })

      // 7. Redirigir al dashboard
      window.location.href = '/dashboard'
    }
  } catch (error) {
    console.error('GitHub login failed:', error)
  }
}
```

---

## Paso 6: Datos que Supabase Recibe de GitHub

```typescript
// Estos datos están disponibles en user.user_metadata:

{
  avatar_url: "https://avatars.githubusercontent.com/u/...",
  email: "usuario@example.com",
  email_verified: false,
  full_name: "John Doe",
  iss: "https://api.github.com",
  name: "John Doe",
  phone_verified: false,
  picture: "https://avatars.githubusercontent.com/u/...",
  provider_id: "12345678", // ID de GitHub
  sub: "12345678",
  user_name: "johndoe" // Username de GitHub
}
```

---

## Paso 7: Guardar Info en Tabla Users

```typescript
async function createUserProfile(user) {
  const { error } = await supabase
    .from('users')
    .insert({
      id: user.id,
      email: user.email,
      github_username: user.user_metadata?.user_name,
      github_id: parseInt(user.user_metadata?.provider_id),
      avatar_url: user.user_metadata?.avatar_url,
      is_active: true,
    })

  if (error && error.code !== '23505') {
    // 23505 = unique constraint (usuario ya existe)
    throw error
  }
}
```

---

## Troubleshooting

### Error: "Invalid OAuth Application"
**Causa**: Client ID o Client Secret incorrecto
**Solución**: Regenera en GitHub Settings → OAuth Apps → Edit

### Error: "Redirect URI mismatch"
**Causa**: URL de callback no coincide
**Solución**: Verifica que sea exactamente:
```
https://[TU_PROYECTO].supabase.co/auth/v1/callback
```

### Error: "Not Implemented"
**Causa**: GitHub no está habilitado en Supabase
**Solución**: Authentication → Providers → Habilitar GitHub

### El login funciona pero no trae datos del usuario
**Causa**: Los permisos de GitHub OAuth no incluyen email
**Solución**: En GitHub OAuth App → Permissions, habilita:
- `user:email` (para obtener email)
- `read:user` (para obtener info pública)

### Usuario intenta desautorizar la app
El usuario puede ir a:
GitHub → Settings → Applications → Authorized OAuth Apps → Revoke

---

## Testing: Cómo Probar en Local

```bash
# 1. Inicia el servidor dev
cd client
npm run dev

# 2. Abre http://localhost:5173

# 3. Haz clic en "Conectar con GitHub"

# 4. Deberías ver:
#    - Redirección a github.com
#    - Login de GitHub (si no estás autenticado)
#    - Pantalla de permisos
#    - Redirección de vuelta a tu app
#    - Usuario autenticado ✅

# 5. En DevTools (F12) → Console, deberías ver:
#    - No errores CORS
#    - auth state updated
#    - usuario.email disponible
```

---

## Setup Automático (Alternativa)

Si prefieres, Supabase puede generar automáticamente las credenciales:

1. Ve a **Authentication** → **Providers**
2. Haz clic en **GitHub**
3. Desplaza a abajo
4. Haz clic en **"Generate GitHub OAuth Credentials"**
5. Te llevará a GitHub automáticamente
6. Autoriza y vuelve a Supabase
7. Las credenciales se llenan automáticamente ✅

---

## Flujo Visual

```
┌─────────────────┐
│  Tu Aplicación  │
│   (localhost)   │
└────────┬────────┘
         │
         │ 1. Click "Login with GitHub"
         ▼
┌─────────────────┐
│   Supabase      │
│ (OAuth Provider)│
└────────┬────────┘
         │
         │ 2. Redirige a:
         │ https://github.com/login/oauth/authorize
         ▼
┌─────────────────┐
│   GitHub.com    │
│  (Pide permisos)│
└────────┬────────┘
         │
         │ 3. Usuario autoriza
         │
         ▼
┌─────────────────┐
│   Supabase      │
│ (Recibe código) │
└────────┬────────┘
         │
         │ 4. Crea sesión y redirige a:
         │ https://tuapp.com/#access_token=...
         ▼
┌─────────────────┐
│  Tu Aplicación  │
│  (Autenticado!) │
└─────────────────┘
```

---

## Checklist Final

- [ ] OAuth App creado en GitHub
- [ ] Client ID copiado
- [ ] Client Secret guardado (no commitear!)
- [ ] GitHub habilitado en Supabase Providers
- [ ] Credenciales pegadas en Supabase
- [ ] URLs de callback correctas
- [ ] Testeado en localhost
- [ ] URLs actualizadas para producción
- [ ] Tabla users con campos GitHub preparada
- [ ] Función para guardar perfil de GitHub implementada

---

## Documentación Oficial

- **Supabase GitHub Auth**: https://supabase.com/docs/guides/auth/social-login/auth-github
- **GitHub OAuth Docs**: https://docs.github.com/en/apps/oauth-apps
- **Troubleshooting**: https://supabase.com/docs/guides/auth/troubleshooting

---

**¿Lista tu app para GitHub OAuth? 🚀**

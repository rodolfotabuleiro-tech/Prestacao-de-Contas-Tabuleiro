import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthUI() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) alert(error.message)
    else alert('Confirme seu e-mail (se aplicável) e faça login')
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Login / Registrar</h2>
      <input className="w-full mb-2 border p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="w-full mb-2 border p-2" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} />
      <div className="flex gap-2">
        <button onClick={signIn} className="px-3 py-2 bg-blue-600 text-white rounded">Entrar</button>
        <button onClick={signUp} className="px-3 py-2 border rounded">Criar conta</button>
      </div>
    </div>
  )
}

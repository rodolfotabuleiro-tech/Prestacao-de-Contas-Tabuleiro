import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import AuthUI from './components/AuthUI'
import PrestacaoForm from './components/PrestacaoForm'
import { AdminDashboard } from './components/AdminDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(r => setUser(r.data?.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => setUser(sess?.user ?? null))
    return () => listener.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return setProfile(null)
    supabase.from('user_profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data)).catch(()=> setProfile(null))
  }, [user])

  if (!user) return <AuthUI />

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Prestação de Contas Tabuleiro</h1>
          <div>
            <span className="mr-4">{user.email}</span>
            <button className="px-3 py-1 border rounded" onClick={() => supabase.auth.signOut()}>Sair</button>
          </div>
        </div>

        {profile?.role === 'admin' ? (
          <AdminDashboard />
        ) : (
          <PrestacaoForm />
        )}
      </div>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/ProfileForm'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, email, role, employee_type, department, job_title, hire_date, avatar_url')
    .eq('user_id', user.id)
    .single()

  // Fallback profile from auth user if no employees row yet
  const profile = emp ?? {
    id: '',
    name: user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: 'employee',
    employee_type: 'full-time',
    department: null,
    job_title: null,
    hire_date: new Date().toISOString().split('T')[0],
    avatar_url: null,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-[#0b2b35]">My Profile</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Update your name, photo, and personal details</p>
      </div>
      <ProfileForm profile={profile} userId={user.id} />
    </div>
  )
}

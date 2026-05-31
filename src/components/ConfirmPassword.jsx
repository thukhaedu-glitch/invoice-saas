import{useState}from'react'
import{auth}from'../firebase'
import{reauthenticateWithCredential,EmailAuthProvider}from'firebase/auth'
import{Lock,X,AlertCircle}from'lucide-react'

export default function ConfirmPassword({onConfirm,onCancel,action='this action'}){
const[password,setPassword]=useState('')
const[error,setError]=useState('')
const[loading,setLoading]=useState(false)
const[showPass,setShowPass]=useState(false)

const handleConfirm=async()=>{
if(!password){setError('Password required');return}
setLoading(true)
setError('')
try{
const credential=EmailAuthProvider.credential(auth.currentUser.email,password)
await reauthenticateWithCredential(auth.currentUser,credential)
onConfirm()
}catch(e){
setError('Incorrect password')
}
setLoading(false)
}

return(
<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
<div style={{background:'white',borderRadius:16,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
<div style={{padding:'20px 24px',borderBottom:'0.5px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
<div style={{display:'flex',alignItems:'center',gap:10}}>
<div style={{width:32,height:32,borderRadius:8,background:'rgba(220,38,38,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
<Lock size={15} color="#dc2626"/>
</div>
<div>
<div style={{fontWeight:600,fontSize:14}}>Confirm Identity</div>
<div style={{fontSize:11,color:'var(--text-3)',marginTop:1}}>Enter password to {action}</div>
</div>
</div>
<button type="button" onClick={onCancel} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}><X size={18}/></button>
</div>
<div style={{padding:24}}>
{error&&(
<div style={{background:'#fcebeb',border:'0.5px solid #fca5a5',color:'#dc2626',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:12,display:'flex',alignItems:'center',gap:6}}>
<AlertCircle size={14}/>{error}
</div>
)}
<div style={{marginBottom:8,fontSize:12,color:'var(--text-2)'}}>
Account: <strong>{auth.currentUser?.email}</strong>
</div>
<div style={{marginBottom:16,position:'relative'}}>
<input
className="form-input"
type={showPass?'text':'password'}
value={password}
onChange={e=>setPassword(e.target.value)}
placeholder="Enter your password..."
onKeyDown={e=>e.key==='Enter'&&handleConfirm()}
autoFocus
style={{paddingRight:40}}
/>
<button type="button" onClick={()=>setShowPass(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:11}}>
{showPass?'Hide':'Show'}
</button>
</div>
<div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
<button type="button" onClick={onCancel} className="btn btn-ghost">Cancel</button>
<button type="button" onClick={handleConfirm} disabled={loading} className="btn btn-primary" style={{background:'#dc2626',boxShadow:'none'}}>
<Lock size={13}/>{loading?'Verifying...':'Confirm'}
</button>
</div>
</div>
</div>
</div>
)
}

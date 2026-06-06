import{db,auth}from'../firebase'
import{collection,addDoc,serverTimestamp}from'firebase/firestore'

export const logAction=async(companyId,{action,module,description,metadata={}})=>{
if(!companyId||!auth.currentUser)return
try{
await addDoc(collection(db,'companies',companyId,'auditLogs'),{
action,
module,
description,
metadata,
userId:auth.currentUser.uid,
userEmail:auth.currentUser.email,
timestamp:serverTimestamp(),
})
}catch(e){console.error('Audit log error:',e)}
}

import emailjs from'@emailjs/browser'

const SERVICE_ID='service_5hait3m'
const TEMPLATE_ID='template_lpm6xzo'
const PUBLIC_KEY='_x4olwB-Hfyx9iXkl'

export const sendInvoiceReminder=async({
clientName,clientEmail,invoiceNumber,amount,status,
companyName,companyEmail,companyPhone,paymentMethods
})=>{
try{
await emailjs.send(SERVICE_ID,TEMPLATE_ID,{
client_name:clientName,
to_email:clientEmail,
invoice_number:invoiceNumber,
amount:Number(amount).toLocaleString(),
status:status||'pending',
company_name:companyName||'',
company_email:companyEmail||'',
company_phone:companyPhone||'',
payment_methods:paymentMethods||'',
},PUBLIC_KEY)
return{success:true}
}catch(e){
console.error(e)
return{success:false,error:e.message}
}
}

import{m as u,j as e,L as p,a as c}from"./index-LrZp3CTo.js";import{A as y}from"./arrow-left-C0FG4GPB.js";const i={terms:{title:"Terms of Service",content:`
## 1. Acceptance of Terms
By creating an account or using C-codit ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.

## 2. Eligibility
You must be at least 18 years of age and legally capable of entering into a binding contract. By using the Platform, you represent that you meet these requirements.

## 3. Your Account
You are responsible for maintaining the confidentiality of your account credentials. You must immediately notify us if you suspect unauthorised access. We are not liable for losses caused by compromised credentials.

## 4. Wallet & Payments
- Wallet balances represent prepaid credit for use on C-codit services only.
- Balances are not deposits, do not earn interest, and are non-transferable to other users.
- Wallet top-ups are processed by Flutterwave (card/bank transfer) or NowPayments (cryptocurrency).
- Refunds are issued to your C-codit wallet, not to original payment methods, except where required by law.

## 5. Services
- **Virtual Numbers**: Numbers are disposable and provided by third-party SMS providers (5sim, SMS-Man). We do not guarantee delivery of SMS codes.
- **Utility Bills**: Bill payments are processed via Flutterwave's Bills API. Processing times depend on the biller.
- **Gift Cards**: Gift cards are delivered digitally. All sales are final once the code is delivered.
- **eSIM**: Coming soon. Terms will be updated when available.

## 6. Prohibited Use
You may not use the Platform to: (a) violate any applicable law; (b) commit fraud; (c) access services for which you are not authorised; (d) attempt to circumvent security measures; or (e) use virtual numbers for illegal activity.

## 7. Refunds
Failed service deliveries are automatically refunded to your wallet. We do not process refunds to external payment methods except where legally required.

## 8. Limitation of Liability
To the maximum extent permitted by law, C-codit's total liability for any claim shall not exceed the amount you paid in the 30 days preceding the claim.

## 9. Changes
We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance.

## 10. Contact
For questions about these Terms, email **legal@c-codit.com**.
    `},privacy:{title:"Privacy Policy",content:`
## 1. Data We Collect
- **Account data**: Name, email address, phone number (optional), country.
- **Transaction data**: Wallet top-up history, service purchases, order details.
- **Usage data**: Login timestamps, IP address, device/browser type (for security purposes).
- **Payment data**: We do not store card numbers. Payments are processed by Flutterwave and NowPayments.

## 2. How We Use Your Data
- To provide and operate C-codit services.
- To detect and prevent fraud and abuse.
- To send transactional emails (receipts, security alerts).
- To comply with legal obligations.

## 3. Data Sharing
We do not sell your personal data. We share limited data with:
- **Payment processors** (Flutterwave, NowPayments): For payment processing.
- **SMS providers** (5sim, SMS-Man): Phone number lookup only.
- **Infrastructure providers** (Render, AWS): Hosting and storage.
- **Law enforcement**: When required by valid legal process.

## 4. Data Retention
We retain account data for as long as your account is active, plus 7 years for financial records. You may request deletion by emailing **privacy@c-codit.com**.

## 5. Security
We use TLS encryption for all data in transit, bcrypt hashing for passwords, and access controls for all internal systems. We perform regular security reviews.

## 6. Cookies
We use only essential session cookies. We do not use advertising or tracking cookies.

## 7. Your Rights
Depending on your jurisdiction, you may have rights to: access your data, correct inaccurate data, delete your data, and port your data. Contact **privacy@c-codit.com** to exercise these rights.

## 8. Children
The Platform is not intended for persons under 18. We do not knowingly collect data from children.

## 9. Changes
We will notify you of material changes by email or in-app notice.

## 10. Contact
**Data Controller**: C-codit  
**Email**: privacy@c-codit.com
    `},cookies:{title:"Cookie Policy",content:`
## What Are Cookies
Cookies are small text files stored on your device when you visit a website.

## Cookies We Use
We use only **strictly necessary cookies**:
- **Session cookie**: Keeps you logged in during your browser session.
- **CSRF token**: Protects against cross-site request forgery attacks.

We do **not** use advertising cookies, analytics cookies, or third-party tracking cookies.

## Managing Cookies
You can disable cookies in your browser settings. Disabling essential cookies will prevent you from logging in.

## Contact
For questions about our cookie use, email **privacy@c-codit.com**.
    `}};function h(o){const r=o.trim().split(`
`),t=[];let s=0;for(const d of r){const a=d.trim();if(!a){t.push(e.jsx("br",{},s++));continue}if(a.startsWith("## "))t.push(e.jsx("h2",{className:"text-xl font-semibold mt-8 mb-3 dark:text-white",children:a.slice(3)},s++));else if(a.startsWith("**")&&a.endsWith("**"))t.push(e.jsx("p",{className:"font-semibold dark:text-white",children:a.slice(2,-2)},s++));else if(a.startsWith("- "))t.push(e.jsx("li",{className:"ml-4 list-disc text-ink-700 dark:text-ink-300",children:a.slice(2)},s++));else{const m=a.split(/\*\*(.*?)\*\*/g).map((n,l)=>l%2===1?e.jsx("strong",{className:"font-semibold dark:text-white",children:n},l):n);t.push(e.jsx("p",{className:"text-ink-700 dark:text-ink-300 leading-relaxed",children:m},s++))}}return t}function x(){const{doc:o="terms"}=u(),r=i[o]??i.terms;return e.jsxs("div",{className:"min-h-screen bg-ink-50 dark:bg-ink-950",children:[e.jsxs("header",{className:"border-b border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-6 py-4 flex items-center gap-4",children:[e.jsx(p,{}),e.jsxs(c,{to:"/",className:"flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900 dark:hover:text-white ml-auto",children:[e.jsx(y,{className:"h-3.5 w-3.5"})," Back"]})]}),e.jsxs("div",{className:"max-w-3xl mx-auto px-6 py-12",children:[e.jsx("div",{className:"flex gap-4 mb-8 border-b border-ink-200 dark:border-ink-800",children:Object.entries(i).map(([t,s])=>e.jsx(c,{to:`/legal/${t}`,className:`pb-3 text-sm font-medium border-b-2 transition -mb-px ${o===t?"border-ink-900 text-ink-900 dark:border-white dark:text-white":"border-transparent text-ink-500 hover:text-ink-700 dark:text-ink-400"}`,children:s.title},t))}),e.jsx("h1",{className:"text-3xl font-semibold tracking-tight dark:text-white mb-2",children:r.title}),e.jsxs("p",{className:"text-sm text-ink-500 dark:text-ink-400 mb-8",children:["Last updated: ",new Date().toISOString().slice(0,10)]}),e.jsx("div",{className:"prose-sm space-y-2",children:h(r.content)}),e.jsxs("div",{className:"mt-12 pt-8 border-t border-ink-200 dark:border-ink-800 text-sm text-ink-500 dark:text-ink-400",children:["Questions? Email us at ",e.jsx("a",{href:"mailto:legal@c-codit.com",className:"text-brand-700 dark:text-brand-400 hover:underline",children:"legal@c-codit.com"})]})]})]})}export{x as default};

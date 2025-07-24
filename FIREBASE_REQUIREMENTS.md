
### 2.2 Migration Strategy
1. **Incremental Move** – migrate one data type at a time  
2. **Data Validation** – verify counts & checksums after each step  
3. **Cloud Backup** – export Firestore to Cloud Storage before each wave  
4. **Rollback Plan** – keep per-step exports for recovery if required  

### 2.3 Real-time Updates
- **Firestore listeners** replace polling
- Live global activity feed
- Real-time price ticks and portfolio values

---

## Phase 3 – Firebase Functions API Middleware

### 3.1 OpenAI Key Protection
- Store OpenAI key in Functions config (`firebase functions:config:set`)
- Per-user rate limits
- Usage metrics & robust error handling

### 3.2 Functions Layout

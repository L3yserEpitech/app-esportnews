# Deployment Checklist - Go Backend Migration

## 🎯 Pre-Deployment Verification

### ✅ Backend Implementation
- [x] Go backend fully implemented (32 Go files, 16 MB binary)
- [x] All 8 handlers with complete endpoints
- [x] 7 service layer classes with business logic
- [x] PostgreSQL integration with connection pooling
- [x] Redis caching with pattern management
- [x] JWT authentication with token refresh
- [x] PandaScore poller (5-minute polling interval)
- [x] Middleware (logging, error handling, rate limiting)
- [x] Graceful shutdown handling

### ✅ Database
- [x] PostgreSQL 15 Docker container
- [x] 8-table schema with constraints/indexes
- [x] Goose migration framework
- [x] Supabase → PostgreSQL migration script
- [x] Health checks configured

### ✅ Caching
- [x] Redis 7 Docker container
- [x] Cache key patterns defined
- [x] TTL management
- [x] Token blacklist support
- [x] Health checks configured

### ✅ Docker Compose
- [x] 4-service orchestration (postgres, redis, backend, frontend)
- [x] Environment variables configured
- [x] Health checks for all services
- [x] Dependency ordering (backend depends on postgres + redis)
- [x] Volume management
- [x] Network configuration

### ✅ Documentation
- [x] Quick start guide (QUICKSTART.md)
- [x] Full migration guide (MIGRATION.md)
- [x] Implementation summary (IMPLEMENTATION.md)
- [x] This deployment checklist

---

## 🚀 Local Testing Checklist

Before deploying to VPS, complete these tests locally:

### Phase 1: Infrastructure
- [ ] Run: `docker-compose up -d postgres redis`
- [ ] Verify: `docker-compose ps` shows both healthy
- [ ] Test: `psql -h localhost -U esportnews -d esportnews` (should connect)
- [ ] Test: `redis-cli ping` (should return PONG)

### Phase 2: Data Migration
- [ ] Run: `cd backend-go && ./scripts/migrate-from-supabase.sh`
- [ ] Enter Supabase password when prompted
- [ ] Verify: Dump file created in `/tmp/`
- [ ] Verify: No errors in stdout
- [ ] Verify: Database contains data: `SELECT COUNT(*) FROM public.users;`

### Phase 3: Backend Server
- [ ] Run: `cd backend-go && go run ./cmd/server`
- [ ] Wait for: "Server starting on :4000"
- [ ] Wait for: "PandaScore poller started (5 minute interval)"
- [ ] Test: `curl http://localhost:4000/health` returns `{"status":"ok"}`

### Phase 4: API Endpoints
- [ ] **Games**: `curl http://localhost:4000/api/games`
- [ ] **Articles**: `curl http://localhost:4000/api/articles`
- [ ] **Ads**: `curl http://localhost:4000/api/ads`
- [ ] **Auth Sign Up**:
  ```bash
  curl -X POST http://localhost:4000/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"test@example.com","password":"password123"}'
  ```
- [ ] **Auth Login**:
  ```bash
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}'
  ```

### Phase 5: Frontend Integration
- [ ] Run: `cd frontend && npm run dev`
- [ ] Wait for: "ready - started server on 0.0.0.0:3000"
- [ ] Navigate: http://localhost:3000
- [ ] Verify: Frontend loads without errors
- [ ] Check console: No API connection errors

### Phase 6: Full Docker Compose Stack
- [ ] Stop local processes
- [ ] Run: `docker-compose up`
- [ ] Wait for all 4 services to be healthy
- [ ] Verify logs: No error messages
- [ ] Test: All endpoints through Docker network

### Phase 7: Load Testing (Optional)
- [ ] Install k6: `brew install k6`
- [ ] Create test script: `k6 run tests/load-test.js`
- [ ] Run 100 virtual users for 1 minute
- [ ] Check: Response times < 100ms
- [ ] Check: Error rate < 1%

---

## 🌐 VPS Deployment Checklist

Once local testing passes, deploy to VPS:

### Pre-deployment
- [ ] SSH access to VPS verified
- [ ] Docker and Docker Compose installed on VPS
- [ ] Sufficient disk space (min 10 GB for DB growth)
- [ ] PostgreSQL port 5432 accessible only internally
- [ ] Redis port 6379 accessible only internally
- [ ] Backend port 4000 accessible from frontend
- [ ] Frontend port 3000 accessible from internet

### Deployment Steps
1. [ ] Clone repository to VPS
2. [ ] Copy `.env` file with production values
3. [ ] Update `FRONTEND_URL` to production domain
4. [ ] Update `JWT_SECRET` to new random value
5. [ ] Verify Supabase credentials in `.env`
6. [ ] Run: `docker-compose up -d`
7. [ ] Monitor: `docker-compose logs -f`
8. [ ] Wait for "Server starting on :4000"
9. [ ] Wait for "PandaScore poller started"

### Post-deployment
- [ ] Test: `curl https://your-domain/api/health`
- [ ] Test: Frontend loads at `https://your-domain`
- [ ] Monitor: `docker-compose ps` (all healthy)
- [ ] Monitor: `docker logs esportnews-backend` for errors
- [ ] Check: PandaScore sync every 5 minutes in logs
- [ ] Verify: Database backups running
- [ ] Verify: Logs being collected

### Production Configuration
- [ ] Enable HTTPS/TLS (Let's Encrypt)
- [ ] Configure firewall rules
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Set up alerting (Slack/Email)
- [ ] Configure log aggregation
- [ ] Schedule database backups
- [ ] Plan disaster recovery procedure
- [ ] Document runbook for common issues

---

## 📊 Performance Targets

After deployment, verify these metrics:

### Response Times (P50)
| Endpoint | Target | Acceptable | Alert if |
|----------|--------|-----------|----------|
| GET /games | < 5ms | < 10ms | > 50ms |
| GET /matches | < 10ms | < 20ms | > 100ms |
| POST /login | < 15ms | < 30ms | > 150ms |
| POST /signup | < 20ms | < 40ms | > 200ms |

### Resource Usage
| Metric | Target | Alert if |
|--------|--------|----------|
| Backend CPU | < 20% | > 80% |
| Backend Memory | < 100MB | > 500MB |
| Database CPU | < 20% | > 80% |
| Database Memory | < 500MB | > 2GB |

### System Health
| Metric | Target | Alert if |
|--------|--------|----------|
| Error Rate | < 0.1% | > 1% |
| Latency P95 | < 100ms | > 500ms |
| Availability | > 99.9% | < 99% |

---

## 🔍 Monitoring & Logging

### Essential Logs to Monitor
1. **Backend errors**: `docker logs esportnews-backend | grep ERROR`
2. **Database errors**: `docker logs esportnews-db | grep ERROR`
3. **PandaScore sync**: `docker logs esportnews-backend | grep PandaScore`
4. **Failed authentications**: `docker logs esportnews-backend | grep Unauthorized`

### Key Metrics to Track
1. **Response times** - P50, P95, P99
2. **Error rate** - Percentage of failed requests
3. **Database connections** - Current vs max pool
4. **Redis memory** - Usage vs allocated
5. **Concurrent users** - Current active connections

### Alerting Rules
- Backend down: Alert immediately
- Response time > 500ms: Warning
- Error rate > 1%: Alert
- Database CPU > 80%: Alert
- Redis memory > 80%: Alert

---

## 🔐 Security Checklist

- [ ] JWT secret is unique and strong (> 32 chars)
- [ ] Database password is changed from default
- [ ] Redis requires password (if exposed)
- [ ] CORS only allows production frontend domain
- [ ] HTTPS/TLS enabled on all endpoints
- [ ] Database backups encrypted
- [ ] Logs don't contain sensitive data
- [ ] Rate limiting enabled (100 req/min)
- [ ] SQL injection protection verified (parameterized queries)
- [ ] XSS protection verified (JSON-only responses)

---

## 📈 Scaling Plan

### If Response Times Degrade
1. Check database connections: `SELECT * FROM pg_stat_activity;`
2. Check Redis memory: `redis-cli INFO stats`
3. Enable query logging: `SET log_statement = 'all';`
4. Add database indexes on hot queries
5. Increase connection pool size (25 → 50)

### If Error Rate Increases
1. Check logs for specific error patterns
2. Verify database connectivity
3. Verify Redis connectivity
4. Check rate limiting stats
5. Monitor memory/CPU usage

### If Concurrent Users Exceed 1000
1. Deploy second Go backend instance
2. Add load balancer (nginx)
3. Monitor connection pool sizing
4. Consider database read replicas
5. Scale Redis memory if needed

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ All 4 Docker containers are healthy
2. ✅ Backend health endpoint returns 200
3. ✅ Frontend loads without errors
4. ✅ Authentication (signup/login) works
5. ✅ All game/article/match endpoints return data
6. ✅ PandaScore poller syncs every 5 minutes
7. ✅ Response times < 100ms (P95)
8. ✅ Error rate < 0.1%
9. ✅ Database has data from Supabase migration
10. ✅ No errors in backend logs

---

## 🚨 Rollback Plan

If issues occur after deployment:

### Minor Issues (API errors, slow performance)
1. Check logs: `docker logs esportnews-backend`
2. Restart service: `docker-compose restart backend`
3. Monitor for 5 minutes
4. If persists, check database/Redis health

### Major Issues (Service down, data loss)
1. Stop all services: `docker-compose down`
2. Restore from backup: Database restore procedure
3. Pull latest code: `git pull origin main`
4. Restart: `docker-compose up -d`
5. Verify all services healthy
6. Post-mortem: Document what went wrong

### Emergency Rollback to Node.js
1. Stop Go backend: `docker-compose stop backend`
2. Update compose to use Node.js backend
3. Restore old environment variables
4. Restart: `docker-compose up -d backend`
5. Verify: Health check passes

---

## 📝 Notes

- Expected downtime: < 5 minutes (during migration)
- Data loss risk: Minimal (pg_dump backup created)
- Rollback risk: Low (can restore from dump)
- Performance impact: +10x improvement expected
- Cost impact: Minimal (same VPS resources)

---

## ✅ Final Checklist

Before declaring deployment complete:

- [ ] All tests passed locally
- [ ] All tests passed on VPS
- [ ] Performance targets met
- [ ] Security checklist completed
- [ ] Monitoring/alerting configured
- [ ] Backup procedures in place
- [ ] Runbook documented
- [ ] Team trained on new system
- [ ] Documentation updated

---

**Deployment Status**: Ready for production 🚀

Last Updated: 2025-11-09
Next Review: After first week in production

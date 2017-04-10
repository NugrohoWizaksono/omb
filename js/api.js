//var tanggal = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
//
//alert(tanggal);

'use strict'

const Job = app.model('jobs')
const Company = app.model('companies')
const JobApplicant = app.model('job-applicants')
const Province = app.model('provinces')
const City = app.model('cities')
const UserNotification = app.model('user-notifications')

exports.index = (req, res, next) => {
  let provinceFilter = callback => {
    if (req.query.location) {
      return Province
        .where('name', 'like', `%${req.query.location.toLowerCase()}%`)
        .fetchAll()
        .then(p => {
          let data = p.toJSON()

          if (Array.isArray(data) && data.length > 0) {
            return async.map(data, (pv, cb) => cb(null, pv.id), (err, r) => {
              if (err) {
                return callback(err)
              }

              return callback(null, r)
            })
          }

          return callback(null, null)
        })
        .catch(callback)
    }

    return callback(null, null)
  }

  let cityFilter = callback => {
    if (req.query.location) {
      return City
        .where('name', 'like', `%${req.query.location.toLowerCase()}%`)
        .fetchAll()
        .then(c => {
          let data = c.toJSON()

          if (Array.isArray(data) && data.length > 0) {
            return async.map(data, (ct, cb) => cb(null, ct.id), (err, r) => {
              if (err) {
                return callback(err)
              }

              return callback(null, r)
            })
          }

          return callback(null, null)
        })
        .catch(callback)
    }

    return callback(null, null)
  }

  let companyFilter = callback => {
    if (req.query.keyword && req.query.keyword.trim().length > 0) {
      Company
        .where('name', 'like', `%${req.query.keyword.trim()}%`)
        .fetchAll()
        .then(comps => {
          let data = comps.toJSON()

          if (Array.isArray(data) && data.length > 0) {
            async.map(data, (comp, cb) => cb(null, comp.id), (err, r) => {
              if (err) {
                callback(err)
              } else {
                callback(null, r)
              }
            })
          } else {
            callback(null, null)
          }
        })
        .catch(callback)
    } else {
      callback(null, null)
    }
  }

  return async.parallel({
    provinces: provinceFilter,
    cities: cityFilter,
    companies: companyFilter
  }, (err, rs) => {
    if (err) {
      return next(err)
    }

    return Job
      .forge()
      .query(qb => {
        let queryWhere = {
          deletedAt: null,
          publish: 'Y'
        }

        if (req.query.salary_type) {
          queryWhere.salaryId = req.query.salary_type
        }

        if (req.query.category) {
          queryWhere.categoryId = req.query.category
        }

        if (req.query.subcategory) {
          queryWhere.subcategoryId = req.query.subcategory
        }

        qb.where(queryWhere)

        if (req.query.keyword) {
          qb.where(sq => {
            if (Array.isArray(rs.companies) && rs.companies.length > 0) {
              sq.whereIn('companyId', rs.companies).orWhere('title', 'like', `%${req.query.keyword}%`)
            } else {
              sq.where('title', 'like', `%${req.query.keyword}%`)
            }
          })
        }

        if (req.query.workload) {
          if (typeof req.query.workload === 'string' && req.query.workload.trim().length > 0) {
            qb.where('workload', 'like', `%${req.query.workload.trim()}%`)
          }

          if (Array.isArray(req.query.workload) && req.query.workload.length > 0) {
            qb.where(sq => {
              req.query.workload.forEach((w, i) => {
                if (typeof w === 'string' && w.trim().length > 0) {
                  if (i > 0) {
                    sq.where('workload', 'like', `%${w.trim()}%`)
                  } else {
                    sq.orWhere('workload', 'like', `%${w.trim()}%`)
                  }
                }
              })
            })
          }
        }

        qb.where(sq => {
          sq.whereIn('status', ['OPEN', 'INTERVIEW'])
        })

        if (Array.isArray(rs.provinces) || Array.isArray(rs.cities)) {
          if (!rs.cities) {
            qb.whereIn('provinceId', rs.provinces)
          } else if (!rs.provinces) {
            qb.whereIn('cityId', rs.cities)
          } else {
            qb.where(sq => {
              sq.whereIn('provinceId', rs.provinces).orWhereIn('cityId', rs.cities)
            })
          }
        }
      })
      .orderBy('boardingAt', 'DESC')
      .orderBy('id', 'DESC')
      .fetchPage({
        withRelated: [{
          company: function (query) {
            query.select('id', 'name', 'data')
          },
          category: function (query) {
            query.select('id', 'name')
          },
          subcategory: function (query) {
            query.select('id', 'name')
          },
          province: function (query) {
            query.select('id', 'name')
          },
          city: function (query) {
            query.select('id', 'name')
          },
          salary: function (query) {
            query.select('id', 'label')
          }
        }],
        columns: ['id', 'companyId', 'title', 'slug', 'categoryId', 'subcategoryId', 'provinceId', 'cityId', 'workload', 'views', 'shares', 'numberOfApplicants', 'salaryId', 'data', 'status', 'closedAt'],
        page: req.query.page || 1,
        pageSize: req.query.page_size || 10
      })
      .then(jobs => {
        return res.Success({
          jobs: jobs,
          pagination: jobs.pagination
        })
      })
      .catch(next)
  })
}

exports.fetch = (req, res, next) => {
  req.checkParams('id', 'please provide valid id').notEmpty()

  let validationErrors = req.validationErrors()

  if (validationErrors) {
    return res.validationError(validationErrors)
  }

  let query = {
    id: req.params.id,
    deletedAt: null
  }

  return Job
    .where(query)
    .fetch({
      withRelated: [{
        category: function (query) {
          query.select('id', 'name')
        },
        subcategory: function (query) {
          query.select('id', 'name')
        },
        province: function (query) {
          query.select('id', 'name')
        },
        city: function (query) {
          query.select('id', 'name')
        },
        salary: function (query) {
          query.select('id', 'label')
        }
      }, 'company'],
      columns: ['id', 'companyId', 'title', 'slug', 'categoryId', 'subcategoryId', 'provinceId', 'cityId', 'workload', 'views', 'shares', 'numberOfApplicants', 'salaryId', 'data', 'status', 'type', 'closedAt']
    })
    .then(r => {
      if (!r) {
        return res.notFound('job not found')
      }

      req.job = r

      return next()
    })
    .catch(next)
}

exports.get = (req, res, next) => {
  let getUserApplication = callback => {
    if (req.me) {
      return JobApplicant
        .where({jobId: req.job.id, userId: req.me.id})
        .fetch()
        .then(data => callback(null, data))
        .catch(callback)
    }

    return callback()
  }

  return async.parallel({
    application: getUserApplication
  }, (err, r) => {
    if (err) {
      return next(err)
    }

    let result = req.job.toJSON()

    result.applied = false

    if (r.application) {
      result.applied = true
    }

    return res.Success(result)
  })
}

exports.updateViews = (req, res, next) => {
  req.job.set('views', req.job.get('views') + 1)

  return req.job.save().then(() => res.Success({views: req.job.get('views')})).catch(next)
}

exports.updateShares = (req, res, next) => {
  req.job.set('shares', req.job.get('shares') + 1)

  return req.job.save().then(() => res.Success({shares: req.job.get('shares')})).catch(next)
}

exports.createApplicant = (req, res, next) => {
  let checkIfAlreadyApplied = callback => {
    return JobApplicant
      .where({jobId: req.job.id, userId: req.me.id})
      .fetch()
      .then(data => {
        if (data) {
          return callback('This job has been applied')
        }

        return callback(null, null)
      })
  }

  let checkIntegrity = (prev, callback) => {
    let company = req.job.related('company')

    if (!company) {
      return callback('Company data for this job is not found')
    }

    return company.load('user').then(model => {
      let ts = model.related('user')

      if (!ts) {
        return callback('User data for this job is not found')
      }

      return callback(null, company, ts)
    })
  }

  let apply = (company, ts, callback) => {
    let updateJob = done => {
      req.job.set('numberOfApplicants', req.job.get('numberOfApplicants') + 1)

      return req.job.save().then(data => done(null, data)).catch(done)
    }
    
    const moment = require('moment')
    let now = moment().format('Y-M-d H:mm:ss')
    
    let newApplicants = done => {
      let applicant = new JobApplicant({
        jobId: req.job.id,
        userId: req.me.id,
        sortlist: null,
        status: 'APPLIED',
        createdAt: now,
        updatedAt: now
      })

      return applicant.save().then(data => done(null, data)).catch(done)
    }
    
    return async.parallel([
      updateJob,
      newApplicants
    ], (err, result) => {
      if (err) {
        return callback(err)
      }

      return callback(null, company, ts, result)
    })
  }

  return async.waterfall([
    checkIfAlreadyApplied,
    checkIntegrity,
    apply
  ], (err, company, ts, result) => {
    if (err) {
      return res.Error(err)
    }

    const moment = require('moment')
    
    let now = moment().format('Y-M-d H:mm:ss')

    let createNotification = callback => {
      let notification = new UserNotification({
        userId: ts.id,
        flag: 0,
        tag: null,
        content: JSON.stringify({
          id: 'Ada pelamar baru untuk posisi <a href="https://www.creasi.co.id/jobboard/' + req.job.id + '/' + req.job.slug + '">' + req.job.title + '</a>. Lihat ditelnya di <a href="https://www.creasi.co.id/dashboard">dashboard</a> kamu.',
          en: 'You have new applicants for posisi <a href="https://www.creasi.co.id/jobboard/' + req.job.id + '/' + req.job.slug + '">' + req.job.title + '</a>. View the detail on your <a href="https://www.creasi.co.id/dashboard">dashboard</a>.'
        }),
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      })

      return notification.save().then(() => callback())
    }

    let sendEmail = callback => {
      const sendmail = app.lib('mail')

      sendmail()
    }

    async.parallel([
      createNotification,
      // sendEmail
    ], () => {})

    return res.Success({})
  })
}
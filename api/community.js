import appealDecision from '../community-works/server/v1/appeal-decision.js'
import appeals from '../community-works/server/v1/appeals.js'
import cleanup from '../community-works/server/v1/cleanup.js'
import commentDecision from '../community-works/server/v1/comment-decision.js'
import commentReportDecision from '../community-works/server/v1/comment-report-decision.js'
import commentReports from '../community-works/server/v1/comment-reports.js'
import comments from '../community-works/server/v1/comments.js'
import mySubmissions from '../community-works/server/v1/my-submissions.js'
import publicationPart from '../community-works/server/v1/publication-part.js'
import publicationToc from '../community-works/server/v1/publication-toc.js'
import publication from '../community-works/server/v1/publication.js'
import publications from '../community-works/server/v1/publications.js'
import reportDecision from '../community-works/server/v1/report-decision.js'
import reports from '../community-works/server/v1/reports.js'
import review from '../community-works/server/v1/review.js'
import submissionAction from '../community-works/server/v1/submission-action.js'
import submissionStatus from '../community-works/server/v1/submission-status.js'
import submissions from '../community-works/server/v1/submissions.js'
import uploadSessions from '../community-works/server/v1/upload-sessions.js'

/** One Vercel Function for the community BFF; each handler retains its own auth and CORS guard. */
const routes = Object.freeze({
  'appeal-decision': appealDecision,
  appeals,
  cleanup,
  'comment-decision': commentDecision,
  'comment-report-decision': commentReportDecision,
  'comment-reports': commentReports,
  comments,
  'my-submissions': mySubmissions,
  'publication-part': publicationPart,
  'publication-toc': publicationToc,
  publication,
  publications,
  'report-decision': reportDecision,
  reports,
  review,
  'submission-action': submissionAction,
  'submission-status': submissionStatus,
  submissions,
  'upload-sessions': uploadSessions,
})

export default {
  fetch(request) {
    const url = new URL(request.url)
    const route = url.searchParams.get('route')
    if (!route || !Object.hasOwn(routes, route)) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    return routes[route].fetch(request)
  },
}

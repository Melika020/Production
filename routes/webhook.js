import express from 'express'
import axios from 'axios'

/**
 * Creates a webhook router with authenticated routes to interact with GitLab.
 * @param {Array} clients - An array to store connected client data (used for webhooks).
 * @returns {import('express').Router} An Express router with webhook routes.
 */
export default function webhookRouter (clients) {
  const router = express.Router()

  router.get('/repos', async (req, res) => {
    try {
      // yek
      const accessToken = req.user?.accessToken

      if (!accessToken) {
        console.error('Missing access token in user session')
        // yek
        return res.status(401).send('Unauthorized: No access token found.')
      }
      // do
      const response = await axios.get('https://gitlab.lnu.se/api/v4/projects?membership=true', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      const repos = response.data
// se
      let html = `
<html>
<head>
  <title>Select Repository</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff0ee;
      color: #343a40;
      padding: 30px;
      line-height: 1.6;
    }

    h1 {
      color: #212529;
      border-bottom: 2px solid lightpink;
      padding-bottom: 5px;
    }

    ul {
      list-style: none;
      padding: 0;
    }

    li {
      background: #fef9e7;
      border: 1px solid #dee2e6;
      padding: 15px;
      margin-bottom: 12px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.1s ease-in-out;
    }

    li:hover {
      transform: scale(1.01);
    }

    button {
      margin-top: 10px;
      margin-right: 8px;
      padding: 6px 12px;
      background-color: #b0e0e6;
      color: #333;
      border: none;
      border-radius: 4px;
      font-size: 0.9em;
      cursor: pointer;
    }

    button:hover {
      background-color: #add8e6;
    }

    a.back {
      display: inline-block;
      margin-bottom: 20px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <a class="back" href="/webhook"><button>← Back to Dashboard</button></a>
  <h1>Select a Repository to Watch</h1>
  <ul>`

      for (const repo of repos) {
        html += `<li><strong>${repo.name}</strong>
    <form method="POST" action="/webhook/create">
      <input type="hidden" name="project_id" value="${repo.id}" />
      <button type="submit">Watch</button>
    </form>
  </li>`
      }

      html += `
  </ul>
</body>
</html>`

      res.send(html)
    } catch (err) {
      console.error('Error fetching repositories:', err.response?.data || err.message)
      res.status(500).send('Failed to fetch user repositories.')
    }
  })
  router.get('/', async (req, res) => {
    const projectId = req.session.projectId
    if (!projectId) {
      return res.redirect('/webhook/repos')
    }
    try {
      const [issuesRes, tagsRes, releasesRes, commitsRes] = await Promise.all([
        axios.get(`https://gitlab.lnu.se/api/v4/projects/${projectId}/issues`, {
          headers: { Authorization: `Bearer ${process.env.GITLAB_TOKEN}` }
        }),
        axios.get(`https://gitlab.lnu.se/api/v4/projects/${projectId}/repository/tags`, {
          headers: { Authorization: `Bearer ${process.env.GITLAB_TOKEN}` }
        }),
        axios.get(`https://gitlab.lnu.se/api/v4/projects/${projectId}/releases`, {
          headers: { Authorization: `Bearer ${process.env.GITLAB_TOKEN}` }
        }),
        axios.get(`https://gitlab.lnu.se/api/v4/projects/${projectId}/repository/commits`, {
          headers: { Authorization: `Bearer ${process.env.GITLAB_TOKEN}` }
        })
      ])

      const issues = issuesRes.data
      const tags = tagsRes.data
      const releases = releasesRes.data
      const commits = commitsRes.data

      let html = `
<html>
<head>
  <title>GitLab Dashboard</title>
 <style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #fff0ee;
    color: #343a40;
    padding: 30px;
    line-height: 1.6;
  }

  h1, h2 {
    color: #212529;
    border-bottom: 2px solid #dee2e6;
    padding-bottom: 5px;
    margin-top: 40px;
    border-bottom: 2px solid lightpink;
    padding-bottom: 5px;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    background: #fef9e7;
    border: 1px solid #dee2e6;
    padding: 15px;
    margin-bottom: 12px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: transform 0.1s ease-in-out;
  }

  li:hover {
    transform: scale(1.01);
  }

  button {
    margin-top: 10px;
    margin-right: 8px;
    padding: 6px 12px;
    background-color: #b0e0e6;
    color: #333;
    border: none;
    border-radius: 4px;
    font-size: 0.9em;
    cursor: pointer;
  }

  button:hover {
    background-color: #add8e6;
  }

  .section {
    margin-bottom: 40px;
  }

  .commit-author {
    color: #6c757d;
    font-size: 0.9em;
  }

  .tag {
    display: inline-block;
    background-color: #e2e3e5;
    padding: 5px 10px;
    border-radius: 20px;
    margin: 4px 6px 4px 0;
    font-size: 0.9em;
  }

  .release-name {
    font-weight: bold;
    color: #0d6efd;
  }

  .release-tag {
    font-size: 0.9em;
    color: #6c757d;
  }
</style>
</head>
<body>
  <a href="/webhook/repos"><button>Select Repository to Watch</button></a>
  <h1>GitLab Issues</h1>
  <ul id="issues">`

      issues.forEach(issue => {
        html += `<li data-id="${issue.iid}">
        <strong>${issue.title}</strong> - ${issue.state}<br>`
        if (issue.state === 'closed') {
          html += `<button onclick="reopenIssue(${issue.iid})">Reopen</button>`
        } else {
          html += `<button onclick="closeIssue(${issue.iid})">Close</button>`
        }
        html += ` <button onclick="commentOnIssue(${issue.iid})">Add Comment</button>
      </li>`
      })

      html += `</ul>
  <h2>Commits</h2>
  <ul id="commits">`

      commits.forEach(commit => {
        html += `<li><strong>${commit.title}</strong> by ${commit.author_name}</li>`
      })

      html += `</ul>
  <h2>Tags</h2>
  <ul id="tags">`

      tags.forEach(tag => {
        html += `<li>${tag.name}</li>`
      })

      html += `</ul>
  <h2>Releases</h2>
  <ul id="releases">`

      releases.forEach(release => {
        html += `<li>${release.name} - ${release.tag_name}</li>`
      })

      html += `</ul>
  <script>
    const ws = new WebSocket('wss://' + location.host + '/webhook');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      let targetList = document.getElementById('issues');
      const li = document.createElement('li');

      if (data.object_kind === 'issue') {
        li.innerHTML = '<strong>' + data.object_attributes.title + '</strong> - ' + data.object_attributes.state;
        targetList = document.getElementById('issues');
      } else if (data.object_kind === 'push') {
        const commits = data.commits.map(c => '<li>' + c.message + ' by ' + c.author.name + '</li>').join('');
        li.innerHTML = '<strong>New Push:</strong><ul>' + commits + '</ul>';
        targetList = document.getElementById('commits');
      } else if (data.object_kind === 'tag_push') {
        const tagName = data.ref.split('/').pop();
        li.innerHTML = '<strong>New Tag:</strong> ' + tagName;
        targetList = document.getElementById('tags');
      } else if (data.object_kind === 'release') {
        li.innerHTML = '<strong>New Release:</strong> ' + data.name + ' - ' + data.tag;
        targetList = document.getElementById('releases');
      } else {
        li.innerHTML = '<em>Unhandled event:</em> ' + data.object_kind;
      }

      targetList.prepend(li);
    };

    async function closeIssue(iid) {
      if (!confirm("Are you sure you want to close this issue?")) return;
      const res = await fetch('/webhook/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iid })
      });
      alert(await res.text());
      location.reload();
    }

    async function commentOnIssue(iid) {
      const comment = prompt("Enter your comment:");
      if (!comment) return;
      const res = await fetch('/webhook/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iid, comment })
      });
      alert(await res.text());
    }

    async function reopenIssue(iid) {
      if (!confirm("Reopen this issue?")) return;
      const res = await fetch('/webhook/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iid })
      });
      alert(await res.text());
      location.reload();
    }
  </script>
</body>
</html>`
      res.send(html)
    } catch (err) {
      console.error(err)
      res.status(500).send('Failed to fetch data from GitLab')
    }
  })

  // Route to Create the Webhook
  router.post('/create', async (req, res) => {
    const accessToken = req.user.accessToken
    const { project_id } = req.body

    try {
      // Store the selected project ID in the session
      req.session.projectId = project_id

      await axios.post(`https://gitlab.lnu.se/api/v4/projects/${project_id}/hooks`, {
        url: `${process.env.WEBHOOK_RECEIVE_URL}`,
        push_events: true,
        issues_events: true,
        tag_push_events: true,
        release_events: true
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      res.redirect('/webhook')
    } catch (err) {
      console.error(err)
      res.status(500).send('Failed to create webhook.')
    }
  })

  // POST route to handle webhooks
  router.post('/', (req, res) => {
    const payload = JSON.stringify(req.body)
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload)
      }
    }

    res.status(200).send('Webhook received')
  })

  // POST to close an issue
  router.post('/close', async (req, res) => {
    const { iid } = req.body
    const projectId = req.session.projectId

    try {
      await axios.put(`https://gitlab.lnu.se/api/v4/projects/${projectId}/issues/${iid}`, {
        state_event: 'close'
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GITLAB_TOKEN}`
        }
      })

      res.send('Issue closed!')
    } catch (err) {
      console.error(err)
      res.status(500).send('Failed to close issue.')
    }
  })

  // POST to add a comment
  router.post('/comment', async (req, res) => {
    const { iid, comment } = req.body
    const projectId = req.session.projectId
    try {
      await axios.post(`https://gitlab.lnu.se/api/v4/projects/${projectId}/issues/${iid}/notes`, {
        body: comment
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GITLAB_TOKEN}`
        }
      })
      res.send('Comment added.')
    } catch (err) {
      console.error(err)
      res.status(500).send('Failed to add comment.')
    }
  })

  // POST to reopen an issue
  router.post('/reopen', async (req, res) => {
    const { iid } = req.body
    const projectId = req.session.projectId
    try {
      await axios.put(`https://gitlab.lnu.se/api/v4/projects/${projectId}/issues/${iid}`, {
        state_event: 'reopen'
      }, {
        headers: {
          Authorization: `Bearer ${process.env.GITLAB_TOKEN}`
        }
      })
      res.send('Issue reopened.')
    } catch (err) {
      console.error(err)
      res.status(500).send('Failed to reopen issue.')
    }
  })

  return router
}

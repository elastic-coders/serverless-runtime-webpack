import "babel-polyfill"
import request from "request-promise"

const headers = {
  'User-Agent': 'Serverless'
};

export default ({repos}) => {

  return Promise.all(repos.map(repo => {
    let uri = `https://api.github.com/repos/${repo}`

    return request({headers, uri, json: true})
      .then(({stargazers_count}) => ({repo, stars: stargazers_count}))
  }))

}
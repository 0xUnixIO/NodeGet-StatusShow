type RepoInfo = {
  user: string;
  repo: string;
};

/**
 * 从 GitHub 或 GitLab 仓库链接中解析出用户名和项目名
 * @param url 仓库链接，支持 HTTPS 和 SSH
 * @returns { user, repo } 或 null（如果无法解析）
 */
export function parseGitRepo(url: string): RepoInfo | null {
  // 去掉末尾可能的 ".git"
  url = url.replace(/\.git$/, "");

  // 正则匹配 HTTPS 链接，例如：
  // https://github.com/user/repo
  // https://gitlab.com/user/repo
  const httpsMatch = url.match(/^https?:\/\/(?:www\.)?(github\.com|gitlab\.com)\/([^\/]+)\/([^\/]+)$/);
  if (httpsMatch) {
    return { user: httpsMatch[2], repo: httpsMatch[3] };
  }

  // 正则匹配 SSH 链接，例如：
  // git@github.com:user/repo.git
  // git@gitlab.com:user/repo.git
  const sshMatch = url.match(/^git@(github\.com|gitlab\.com):([^\/]+)\/([^\/]+)$/);
  if (sshMatch) {
    return { user: sshMatch[2], repo: sshMatch[3] };
  }

  // 匹配不到返回 null
  return null;
}
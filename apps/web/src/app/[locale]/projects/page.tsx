'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { GitHubBrandIcon } from '~/components/icons/platform/GitHubBrandIcon'
import { ProjectList } from '~/components/modules/project/ProjectList'
import { NothingFound } from '~/components/modules/shared/NothingFound'
import { Loading } from '~/components/ui/loading'
import { BottomToUpTransitionView } from '~/components/ui/transition'
import { fetchGitHubProjects, mergeProjects } from '~/lib/github-projects'
import { noopArr } from '~/lib/noop'
import { apiClient } from '~/lib/request'
import { useAggregationSelector } from '~/providers/root/aggregation-data-provider'

export default function Page() {
  const t = useTranslations('projects')
  const tCommon = useTranslations('common')
  const {
    data,
    isLoading,
    error: cmsError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await apiClient.project.getAll()
      return data.$serialized
    },
    refetchOnMount: 'always',
    meta: { persist: false },
  })

  const githubUsername = useAggregationSelector(
    (state) => state.user?.socialIds?.github,
  )
  const github = useQuery({
    queryKey: ['github-projects', githubUsername],
    queryFn: async () => {
      let cached = false
      const projects = await fetchGitHubProjects(githubUsername!, () => {
        cached = true
      })
      return { projects, cached }
    },
    enabled: !!githubUsername,
    staleTime: 5 * 60 * 1000,
    meta: { persist: false },
  })

  if (isLoading || (!!githubUsername && github.isLoading)) {
    return <Loading useDefaultLoadingText />
  }

  const projects = mergeProjects(
    data || noopArr,
    github.data?.projects || noopArr,
  )

  return (
    <div className="mt-10">
      <header className="prose my-12 flex items-center">
        <h1 className="flex items-center">
          {t('page_title')}{' '}
          {githubUsername && (
            <a
              href={`https://github.com/${githubUsername}`}
              className="ml-2 inline-flex text-inherit!"
              target="_blank"
              aria-label={tCommon('aria_view_on_github')}
              rel="noopener noreferrer"
            >
              <GitHubBrandIcon />
            </a>
          )}
        </h1>
      </header>
      <main>
        {github.data?.cached && (
          <p role="status" className="mb-6 text-sm text-base-content/70">
            {t('cached_projects')}
          </p>
        )}
        {(cmsError || github.error) && (
          <p role="alert" className="mb-6 text-sm text-red-600">
            {t('sync_error')}
          </p>
        )}
        <BottomToUpTransitionView>
          {projects.length ? (
            <ProjectList projects={projects} />
          ) : (
            <NothingFound />
          )}
        </BottomToUpTransitionView>
      </main>
    </div>
  )
}

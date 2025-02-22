import { GET_COMMITS } from "./commitQueries";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Commit, PendingChange, SortOrder } from "../../models";
import { ApolloError, useLazyQuery } from "@apollo/client";
import { groupBy } from "lodash";

const MAX_ITEMS_PER_LOADING = 20;

export type CommitChangesByResource = (commitId: string) => {
  resourceId: string;
  changes: PendingChange[];
}[];

export interface CommitUtils {
  commits: Commit[];
  lastCommit: Commit;
  commitsError: ApolloError;
  commitsLoading: boolean;
  commitChangesByResource: (commitId: string) => {
    resourceId: string;
    changes: PendingChange[];
  }[];
  refetchCommitsData: (refetchFromStart?: boolean) => void;
  refetchLastCommit: () => void;
  disableLoadMore: boolean;
}

const useCommits = (currentProjectId: string, maxCommits?: number) => {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [lastCommit, setLastCommit] = useState<Commit>();
  const [commitsCount, setCommitsCount] = useState(1);
  const [disableLoadMore, setDisableLoadMore] = useState(false);

  const [
    getInitialCommits,
    {
      data: commitsData,
      error: commitsError,
      loading: commitsLoading,
      refetch: refetchCommits,
    },
  ] = useLazyQuery(GET_COMMITS, {
    notifyOnNetworkStatusChange: true,
    variables: {
      projectId: currentProjectId,
      take: maxCommits || MAX_ITEMS_PER_LOADING,
      skip: 0,
      orderBy: {
        createdAt: SortOrder.Desc,
      },
    },
    onCompleted: (data) => {
      if (!data?.commits.length || data?.commits.length < MAX_ITEMS_PER_LOADING)
        setDisableLoadMore(true);
    },
  });

  // get initial commits for a specific project
  useEffect(() => {
    if (!currentProjectId) return;

    getInitialCommits();
    commitsCount !== 1 && setCommitsCount(1);
  }, [currentProjectId]);

  // fetch the initial commit data and assign it
  useEffect(() => {
    if (!commitsData && !commitsData?.commits.length) return;

    if (commits.length) return;

    if (commitsLoading) return;

    setCommits(commitsData?.commits);
    setLastCommit(commitsData?.commits[0]);
  }, [commitsData?.commits, commits]);

  const refetchCommitsData = useCallback(
    (refetchFromStart?: boolean) => {
      refetchCommits({
        skip: refetchFromStart ? 0 : commitsCount * MAX_ITEMS_PER_LOADING,
        take: MAX_ITEMS_PER_LOADING,
      });
      refetchFromStart && setCommits([]);
      setCommitsCount(refetchFromStart ? 1 : commitsCount + 1);
    },
    [refetchCommits, setCommitsCount, commitsCount]
  );

  const refetchLastCommit = useCallback(() => {
    refetchCommits({
      skip: 0,
      take: 1,
    });
  }, []);

  // pagination refetch
  useEffect(() => {
    if (!commitsData?.commits?.length || commitsCount === 1 || commitsLoading)
      return;

    setCommits([...commits, ...commitsData.commits]);
  }, [commitsData?.commits, commitsCount]);

  // last commit refetch
  useEffect(() => {
    if (!commitsData?.commits?.length || commitsData?.commits?.length > 1)
      return;

    setLastCommit(commitsData?.commits[0]);
  }, [commitsData?.commits]);

  const getCommitIdx = (commits: Commit[], commitId: string): number =>
    commits.findIndex((commit) => commit.id === commitId);

  const commitChangesByResource = useMemo(
    () => (commitId: string) => {
      const commitIdx = getCommitIdx(commits, commitId);
      const changesByResource = groupBy(
        commits[commitIdx]?.changes,
        (originChange) => {
          if (!originChange.resource) return;
          return originChange.resource.id;
        }
      );
      return Object.entries(changesByResource).map(([resourceId, changes]) => {
        return {
          resourceId,
          changes,
        };
      });
    },
    [commits]
  );

  return {
    commits,
    lastCommit,
    commitsError,
    commitsLoading,
    commitChangesByResource,
    refetchCommitsData,
    refetchLastCommit,
    disableLoadMore,
  };
};

export default useCommits;

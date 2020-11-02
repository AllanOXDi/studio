import flatMap from 'lodash/flatMap';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';

import { validateNodeDetails, validateNodeFiles } from 'shared/utils/validation';
import { ContentKindsNames } from 'shared/leUtils/ContentKinds';
import { RolesNames } from 'shared/leUtils/Roles';
import { NEW_OBJECT } from 'shared/constants';

function sorted(nodes) {
  return sortBy(nodes, ['lft']);
}

export function getContentNode(state, getters) {
  return function(contentNodeId) {
    const node = state.contentNodesMap[contentNodeId];
    if (node) {
      const thumbnail_encoding = JSON.parse(node.thumbnail_encoding || '{}');
      const tags = Object.keys(node.tags || {});
      const aggregateValues = {};
      if (node.kind === ContentKindsNames.TOPIC) {
        const children = getters.getContentNodeChildren(contentNodeId);
        for (let child of children) {
          aggregateValues['error_count'] =
            (aggregateValues['error_count'] || 0) +
            (child['error_count'] || Number(!child['complete']));
          aggregateValues['resource_count'] =
            (aggregateValues['resource_count'] || 0) +
            (child['resource_count'] || Number(child['kind'] !== ContentKindsNames.TOPIC));
          aggregateValues['total_count'] =
            (aggregateValues['total_count'] || 0) + child['total_count'] + 1;
          aggregateValues['coach_count'] =
            (aggregateValues['coach_count'] || 0) +
            (child['coach_count'] || Number(child['role_visibility'] === RolesNames.COACH));
          aggregateValues['has_updated_descendants'] =
            aggregateValues['has_updated_descendants'] ||
            child['has_updated_descendants'] ||
            (child['changed'] && child['published']);
          aggregateValues['has_new_descendants'] =
            aggregateValues['has_new_descendants'] ||
            child['has_new_descendants'] ||
            (child['changed'] && !child['published']);
        }
      }
      return {
        ...node,
        ...aggregateValues,
        thumbnail_encoding,
        tags,
      };
    }
  };
}

export function getContentNodeDescendants(state, getters) {
  return function(contentNodeId) {
    // First find the immediate children of the target tree node
    return getters.getContentNodeChildren(contentNodeId).reduce((descendants, contentNode) => {
      // Then recursively call ourselves again for each child, so for this structure:
      // (target)
      //  > (child-1)
      //     > (grandchild-1)
      //  > (child-2)
      //
      // it should map out to: [(child-1), (grandchild-1), (child-2)]
      descendants.push(contentNode, ...getters.getContentNodeDescendants(contentNode.id));
      return descendants;
    }, []);
  };
}

export function hasChildren(state, getters) {
  return function(id) {
    return getters.getContentNode(id).total_count > 0;
  };
}

export function countContentNodeDescendants(state, getters) {
  return function(contentNodeId) {
    return getters.getContentNodeDescendants(contentNodeId).length;
  };
}

export function getContentNodes(state, getters) {
  return function(contentNodeIds) {
    return sorted(contentNodeIds.map(id => getters.getContentNode(id)).filter(node => node));
  };
}

export function getTopicAndResourceCounts(state, getters) {
  return function(contentNodeIds) {
    return getters.getContentNodes(contentNodeIds).reduce(
      (totals, node) => {
        const isTopic = node.kind === ContentKindsNames.TOPIC;
        const subtopicCount = node.total_count - node.resource_count;
        const resourceCount = isTopic ? node.resource_count : 1;
        const topicCount = isTopic ? 1 : 0;
        return {
          topicCount: totals.topicCount + topicCount + subtopicCount,
          resourceCount: totals.resourceCount + resourceCount,
        };
      },
      { topicCount: 0, resourceCount: 0 }
    );
  };
}

export function getContentNodeChildren(state, getters) {
  return function(contentNodeId) {
    return sorted(
      Object.values(state.contentNodesMap)
        .filter(contentNode => contentNode.parent === contentNodeId)
        .map(node => getters.getContentNode(node.id))
        .filter(Boolean)
    );
  };
}

export function getContentNodeAncestors(state, getters) {
  return function(id, includeSelf = false) {
    let node = getters.getContentNode(id);

    if (!node || !node.parent) {
      return [node].filter(Boolean);
    }

    const self = includeSelf ? [node] : [];
    return getters.getContentNodeAncestors(node.parent, true).concat(self);
  };
}

export function getContentNodeIsValid(state, getters, rootState, rootGetters) {
  return function(contentNodeId) {
    const contentNode = state.contentNodesMap[contentNodeId];
    return (
      contentNode &&
      (contentNode[NEW_OBJECT] ||
        (getContentNodeDetailsAreValid(state)(contentNodeId) &&
          getContentNodeFilesAreValid(state, getters, rootState, rootGetters)(contentNodeId) &&
          rootGetters['assessmentItem/getAssessmentItemsAreValid']({
            contentNodeId,
            ignoreNew: true,
          })))
    );
  };
}

export function getContentNodeDetailsAreValid(state) {
  return function(contentNodeId) {
    const contentNode = state.contentNodesMap[contentNodeId];
    return contentNode && (contentNode[NEW_OBJECT] || !validateNodeDetails(contentNode).length);
  };
}

export function getContentNodeFilesAreValid(state, getters, rootState, rootGetters) {
  return function(contentNodeId) {
    const contentNode = state.contentNodesMap[contentNodeId];
    if (contentNode && contentNode.kind !== ContentKindsNames.TOPIC) {
      let files = rootGetters['file/getContentNodeFiles'](contentNode.id);
      if (files.length) {
        // Don't count errors before files have loaded
        return !validateNodeFiles(files).length;
      } else if (
        contentNode.kind === ContentKindsNames.TOPIC ||
        contentNode.kind === ContentKindsNames.EXERCISE
      ) {
        return true;
      } else {
        return false;
      }
    }
    return true;
  };
}

function getStepDetail(state, getters, contentNodeId) {
  const stepDetail = {
    id: contentNodeId,
    title: '',
    kind: '',
    parentTitle: '',
  };

  const node = getters.getContentNode(contentNodeId);

  if (!node) {
    return stepDetail;
  }

  stepDetail.title = node.title;
  stepDetail.kind = node.kind;

  const parentNodeId = state.contentNodesMap[contentNodeId].parent;

  if (parentNodeId) {
    const parentNode = getters.getContentNode(parentNodeId);
    if (parentNode) {
      stepDetail.parentTitle = parentNode.title;
    }
  }

  return stepDetail;
}

/* eslint-disable no-unused-vars */
function getImmediatePreviousStepsIds(state) {
  return function(contentNodeId) {
    return Object.keys(state.previousStepsMap[contentNodeId] || {});
  };
}

function getImmediateNextStepsIds(state) {
  return function(contentNodeId) {
    return Object.keys(state.nextStepsMap[contentNodeId] || {});
  };
}

/**
 * Return a list of immediate previous steps of a node
 * where a step has following interface:
 * { id, title, kind, parentTitle }
 */
export function getImmediatePreviousStepsList(state, getters) {
  return function(contentNodeId) {
    return getImmediatePreviousStepsIds(state)(contentNodeId).map(stepId =>
      getStepDetail(state, getters, stepId)
    );
  };
}

/**
 * Return a list of immediate next steps of a node
 * where a step has following interface:
 * { id, title, kind, parentTitle }
 */
export function getImmediateNextStepsList(state, getters) {
  return function(contentNodeId) {
    return getImmediateNextStepsIds(state)(contentNodeId).map(stepId =>
      getStepDetail(state, getters, stepId)
    );
  };
}

/**
 * Return count of immediate previous and next steps
 * of a node.
 */
export function getImmediateRelatedResourcesCount(state) {
  return function(contentNodeId) {
    const previousStepsCount = getImmediatePreviousStepsIds(state)(contentNodeId).length;
    const nextStepsCount = getImmediateNextStepsIds(state)(contentNodeId).length;

    return previousStepsCount + nextStepsCount;
  };
}

function findNodeInMap(map, rootNodeId, nodeId) {
  if (rootNodeId === nodeId) {
    return false;
  }
  function recurseMaps(targetId, visitedNodes = []) {
    // Copy the visitedNodes set so that we
    // handle it differently for each branch of the graph
    visitedNodes = new Set(visitedNodes);
    if (visitedNodes.has(targetId)) {
      // Immediately return false if we have already
      // visited this node, to prevent a cyclic recursion.
      return false;
    }
    visitedNodes.add(targetId);
    const nextSteps = map[targetId];
    if (nextSteps) {
      for (let nextStep in nextSteps) {
        if (nextStep === nodeId) {
          return true;
        } else {
          if (recurseMaps(nextStep, visitedNodes)) {
            return true;
          }
        }
      }
    }
    return false;
  }
  return recurseMaps(rootNodeId);
}

/**
 * Does a node belongs to next steps of a root node?
 */
export function isNextStep(state) {
  return function({ rootNodeId, nodeId }) {
    return findNodeInMap(state.nextStepsMap, rootNodeId, nodeId);
  };
}

/**
 * Does a node belongs to previous steps of a root node?
 */
export function isPreviousStep(state) {
  return function({ rootNodeId, nodeId }) {
    return findNodeInMap(state.previousStepsMap, rootNodeId, nodeId);
  };
}

function uniqListByKey(state, key) {
  return uniqBy(Object.values(state.contentNodesMap), key)
    .map(node => node[key])
    .filter(node => node);
}

export function authors(state) {
  return uniqListByKey(state, 'author');
}

export function providers(state) {
  return uniqListByKey(state, 'provider');
}

export function aggregators(state) {
  return uniqListByKey(state, 'aggregator');
}

export function copyrightHolders(state) {
  return uniqListByKey(state, 'copyright_holder');
}

export function tags(state) {
  return uniq(
    flatMap(Object.values(state.contentNodesMap), node => Object.keys(node['tags'] || {})).filter(
      t => t
    )
  ).sort();
}

export function nodeExpanded(state) {
  return function(id) {
    return Boolean(state.expandedNodes[id]);
  };
}

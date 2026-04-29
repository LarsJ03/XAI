import sourceData from "../data/trials.json" with { type: "json" };

const rawTrials = sourceData.trials.slice(0, 5);

function withPublicAsset(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

export const methods = [
  {
    id: "PIECE",
    label: "PIECE",
    description:
      "PIECE generates counterfactuals for images by changing semantically meaningful superpixels. It first divides the image into superpixels and assigns each one a probability of being relevant to the classification. It then replaces superpixels according to those probabilities while searching for a combination that changes the predicted class. Because the changes are localized to coherent image regions, the resulting counterfactuals tend to be interpretable."
  },
  {
    id: "Min-Edit",
    label: "Min-Edit",
    description:
      "Min-edit focuses on finding the minimal amount of change to the input that causes a class flip. Its optimization objective is to minimize the number of changed superpixels. Because it prioritizes minimal change, the counterfactuals may not always be visually coherent, which can be a drawback when the goal is interpretation."
  },
  {
    id: "C-Min-Edit",
    label: "C-Min-Edit",
    description:
      "C-min-edit is similar to Min-edit, but the constrained variant adds a realism constraint to the changes. It restricts superpixel edits to those that are plausible given the data distribution, balancing minimality and plausibility. This can produce counterfactuals that are both simple and visually coherent, although the narrower search space can cause the method to fail in some cases."
  },
  {
    id: "alibi-Proto-CF",
    label: "Alibi Proto-CF",
    description:
      "Alibi-proto-cf searches in feature space toward the nearest prototype of the target class. First, prototypes are precomputed with k-means or an autoencoder, where a prototype is a representative embedding for a class. Then an optimization algorithm moves the input in feature space until it is classified as the target class. Its loss balances prediction loss, proximity to the original image, and proximity to the prototype, supporting realism and coherence."
  }
];

export const metrics = [
  {
    id: "correctness",
    label: "Correctness",
    description:
      "Whether the model actually predicts the target class for the modified image."
  },
  {
    id: "l2",
    label: "L2 Distance",
    description:
      "How large the overall image change is. Lower means the result stays closer to the original."
  },
  {
    id: "implausibility",
    label: "Implausibility",
    description:
      "How far the image appears to move away from realistic examples. Lower is better."
  },
  {
    id: "optimTime",
    label: "Generation Time",
    description:
      "How long the method needed to generate the counterfactual. Useful context, but not a quality score by itself."
  }
];

export const conditionMeta = {
  dashboard: {
    label: "Preparation phase",
    description:
      "Before the trial starts, you will review a few examples to understand how different methods change an image and how those changes relate to the target class."
  },
  text: {
    label: "Preparation phase",
    description:
      "Before the trial starts, you will review a short explanation of the task and the methods you will compare."
  }
};

export const decisionCriteria = [
  {
    label: "Did it reach the target?",
    summary: "After the image is changed, does the model now predict the target class?"
  },
  {
    label: "Does the change make sense?",
    summary: "Can you see what changed, and does that change make the result look closer to the target class?"
  },
  {
    label: "Does it still look reasonable?",
    summary: "Does the changed image still look like a believable example instead of a strange artifact?"
  },
  {
    label: "Can you compare methods confidently?",
    summary: "Do you feel you have enough information to choose the strongest explanation?"
  }
];

export const trialExamples = rawTrials.map((trial) => ({
  ...trial,
  originalAsset: withPublicAsset(trial.originalAsset),
  options: trial.options
    .filter((option) => option.available)
    .map((option) => ({
      ...option,
      asset: withPublicAsset(option.asset)
    }))
}));

export const preTaskQuestions = [
  {
    id: "xai_understanding",
    kind: "likert",
    label: "How do you rate your own understanding of explainable AI methods?"
  },
  {
    id: "counterfactual_good_explanation_rating",
    kind: "likert",
    label: "Do you consider a counterfactual explanation to be a good explanation?"
  },
  {
    id: "plausibility_vs_correctness",
    kind: "text",
    label: "Which matters more to you: plausibility for a human viewer, or correctness according to the model? Why?",
    placeholder: "Explain which one matters more to you and why."
  },
  {
    id: "personal_criteria",
    kind: "text",
    label: "If you had to rate an explanation, which criteria would you personally use?",
    placeholder: "Describe the criteria you would use when judging an explanation."
  }
];

export const postTaskLikertQuestions = [
  {
    id: "understood_counterfactual",
    label: "The tool helped me better understand what the counterfactual explanation was showing."
  },
  {
    id: "hard_to_see_differences",
    label: "I found it hard to see how the 5 different explanation models differed from each other."
  },
  {
    id: "felt_plausible",
    label: "I found the explanations plausible."
  },
  {
    id: "difficult_to_interpret",
    label: "I found the explanations difficult to interpret."
  },
  {
    id: "felt_convincing",
    label: "I found the explanations convincing."
  },
  {
    id: "felt_confident",
    label: "I felt confident in judging the explanations."
  },
  {
    id: "compare_more_confidently",
    label: "The information provided helped me compare explanations more confidently."
  },
  {
    id: "trusted_own_evaluation",
    label: "I trusted my own evaluation of which explanation was better."
  },
  {
    id: "information_manageable",
    label: "The amount of information shown was manageable."
  },
  {
    id: "format_easy",
    label: "The format made comparison between the different models easy."
  },
  {
    id: "felt_overwhelmed",
    label: "The presentation felt confusing or overwhelming."
  }
];

export const postTaskOpenQuestions = [
  {
    id: "helped_most",
    label: "What helped you most when making your judgment?",
    placeholder: "Mention the cues, visuals, or explanations that helped most."
  },
  {
    id: "comparison_experience",
    label: "How did you experience comparing the explanations when making your judgment? Please describe anything that made this easier or harder.",
    placeholder: "Describe what made the comparison easier or harder for you."
  },
  {
    id: "setup_improvements",
    label: "What would you improve about the setup of this survey?",
    placeholder: "Suggest any change that would improve the survey setup."
  }
];

export const dashboardFeedbackQuestions = [];

export function getTrialByIndex(index) {
  return trialExamples[index] || null;
}

export function getTrialById(trialId) {
  return trialExamples.find((trial) => trial.id === trialId) || null;
}

export function getConditionLabel(condition) {
  return conditionMeta[condition]?.label || condition;
}

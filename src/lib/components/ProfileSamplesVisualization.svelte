<script lang="ts">
	export let graph: Float32Array;

  function makeSVGPath(graph: Float32Array) {
    let path = "M 0 0";
    for (let i = 0; i < graph.length; i++) {
      const x = (i/graph.length*800).toFixed(2);
      const y = ((1 - graph[i]) * 40).toFixed(2);
      path += ` L ${x} ${y}`;
    }
    return path;
  }
</script>

<div style="height: 80px; border: 1px solid black">
  <svg width="100%" height="100%" viewBox="0 0 800 40">
    <path d={makeSVGPath(graph)} fill="none" stroke="black" stroke-width="1"/>
  </svg>
</div>
